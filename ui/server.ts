import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";
import express from "express";
import { resolveDefaultWorkdir, resolveStateBaseDir } from "../src/paths.js";

export type StartServerOptions = {
  host?: string;
  port?: number;
  defaultWorkdir?: string;
  stateBaseDir?: string;
};

type SessionStatus = "running" | "succeeded" | "failed" | "stopped";

type SessionRecord = {
  id: string;
  goal: string;
  maxIterations: number;
  workdir: string;
  stateDir: string;
  startedAt: string;
  endedAt?: string;
  status: SessionStatus;
  threadId?: string;
};

type ArtifactSnapshot = {
  planLog?: string;
  buildLog?: string;
  planFile?: string;
  threadId?: string;
};

type Client = { id: string; res: express.Response };

type ServerContext = {
  app: express.Express;
  stop: () => void;
};

function readArtifacts(stateDir: string): ArtifactSnapshot {
  const snapshot: ArtifactSnapshot = {};
  const planLog = path.join(stateDir, "plan_out.log");
  const buildLog = path.join(stateDir, "build_out.log");
  const planFile = path.join(stateDir, "IMPLEMENTATION_PLAN.md");
  const threadFile = path.join(stateDir, "thread_id");

  if (fs.existsSync(planLog)) snapshot.planLog = fs.readFileSync(planLog, "utf8");
  if (fs.existsSync(buildLog)) snapshot.buildLog = fs.readFileSync(buildLog, "utf8");
  if (fs.existsSync(planFile)) snapshot.planFile = fs.readFileSync(planFile, "utf8");
  if (fs.existsSync(threadFile)) snapshot.threadId = fs.readFileSync(threadFile, "utf8").trim();
  return snapshot;
}

function resolveLoopRunner(runtimeRoot: string): { command: string; args: string[] } {
  const jsPath = path.join(runtimeRoot, "src", "loop-runner.js");
  if (fs.existsSync(jsPath)) {
    return { command: process.execPath, args: [jsPath] };
  }

  const tsPath = path.join(runtimeRoot, "src", "loop-runner.ts");
  if (fs.existsSync(tsPath)) {
    const bin = process.platform === "win32" ? "tsx.cmd" : "tsx";
    const tsxPath = path.join(runtimeRoot, "node_modules", ".bin", bin);
    if (fs.existsSync(tsxPath)) {
      return { command: tsxPath, args: [tsPath] };
    }
  }

  throw new Error("Loop runner not found (expected dist build output).");
}

function createServerContext(options: StartServerOptions): ServerContext {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const runtimeRoot = path.resolve(__dirname, "..");

  const defaultWorkdir = options.defaultWorkdir ?? resolveDefaultWorkdir();
  const stateBaseDir = options.stateBaseDir ?? resolveStateBaseDir();
  fs.mkdirSync(stateBaseDir, { recursive: true });
  const sessionsFile = path.join(stateBaseDir, "sessions.json");

  const loopRunner = resolveLoopRunner(runtimeRoot);

  const app = express();
  const jsonParser = express.json({ limit: "1mb" });
  app.get("/favicon.ico", (_req, res) => res.status(204).end());
  app.use(express.static(path.join(__dirname, "public")));

  const clients: Client[] = [];
  let child: ChildProcessWithoutNullStreams | null = null;
  let currentSession: SessionRecord | null = null;
  let logBuffer: string[] = [];

  function broadcast(line: string) {
    logBuffer.push(line);
    const payload = `data: ${line}\n\n`;
    clients.forEach((c) => c.res.write(payload));
  }

  function saveSessions(update: (sessions: SessionRecord[]) => SessionRecord[]) {
    let sessions: SessionRecord[] = [];
    if (fs.existsSync(sessionsFile)) {
      try {
        sessions = JSON.parse(fs.readFileSync(sessionsFile, "utf8"));
      } catch {
        sessions = [];
      }
    }
    const next = update(sessions);
    fs.writeFileSync(sessionsFile, JSON.stringify(next, null, 2));
  }

  function normalizeWorkdir(input: string | undefined): string {
    if (!input) return defaultWorkdir;
    return path.isAbsolute(input) ? input : path.resolve(defaultWorkdir, input);
  }

  function startSession(goal: string, maxIterations: number, workdirInput: string, createIfMissing: boolean) {
    if (child) {
      throw new Error("A run is already in progress");
    }

    let workdir = normalizeWorkdir(workdirInput);
    if (!fs.existsSync(workdir)) {
      if (createIfMissing) {
        fs.mkdirSync(workdir, { recursive: true });
      } else {
        throw new Error(`Workdir not found: ${workdir}`);
      }
    }

    const stateDir = path.join(stateBaseDir, Buffer.from(workdir).toString("base64url"));
    fs.mkdirSync(stateDir, { recursive: true });

    logBuffer = [];
    const id = randomUUID();
    const startedAt = new Date().toISOString();
    currentSession = {
      id,
      goal,
      maxIterations,
      workdir,
      stateDir,
      startedAt,
      status: "running",
    };

    saveSessions((sessions) => [...sessions, currentSession!]);

    broadcast(`[milhouse] Starting run…`);
    broadcast(`[milhouse] workdir: ${workdir}`);
    broadcast(`[milhouse] state dir: ${stateDir}`);

    const args = [
      ...loopRunner.args,
      "--goal",
      goal,
      "--max-iterations",
      String(maxIterations),
      "--workdir",
      workdir,
      "--state-dir",
      stateDir,
    ];

    child = spawn(loopRunner.command, args, {
      cwd: runtimeRoot,
      env: process.env,
    });

    child.stdout.on("data", (data: Buffer) => {
      const lines = data.toString().split(/\r?\n/).filter(Boolean);
      lines.forEach((l) => {
        broadcast(l);
        const threadMatch = l.match(/thread:\s*([0-9a-zA-Z-]+)/);
        if (threadMatch && currentSession) currentSession.threadId = threadMatch[1];
      });
    });
    child.stderr.on("data", (data: Buffer) => {
      data
        .toString()
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((l) => broadcast(`[stderr] ${l}`));
    });
    child.on("exit", (code, signal) => {
      broadcast(`[exit] code=${code ?? "null"} signal=${signal ?? "null"}`);
      if (currentSession) {
        currentSession.status = code === 0 ? "succeeded" : signal === "SIGTERM" ? "stopped" : "failed";
        currentSession.endedAt = new Date().toISOString();
        saveSessions((sessions) =>
          sessions.map((s) => (s.id === currentSession!.id ? currentSession! : s)),
        );
      }
      child = null;
    });
  }

  function stopSession() {
    if (child) {
      child.kill();
    }
  }

  function parseBrowseDefaultPath(req: express.Request): string | undefined {
    const body: unknown = (req as any).body;
    if (!body) return undefined;
    if (typeof body === "string") {
      const trimmed = body.trim();
      if (!trimmed) return undefined;
      try {
        const parsed = JSON.parse(trimmed) as { defaultPath?: unknown };
        return typeof parsed.defaultPath === "string" ? parsed.defaultPath : undefined;
      } catch {
        return undefined;
      }
    }
    if (typeof body === "object") {
      const maybe = body as { defaultPath?: unknown };
      return typeof maybe.defaultPath === "string" ? maybe.defaultPath : undefined;
    }
    return undefined;
  }

  async function browseFolder(defaultPath?: string): Promise<string | null> {
    return await new Promise((resolve, reject) => {
      const isWindows = process.platform === "win32";
      const isMac = process.platform === "darwin";
      const isLinux = process.platform === "linux";

      if (isWindows) {
        const initialDirectory = defaultPath?.trim() ? defaultPath.replace(/'/g, "''") : "";

        const script = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

function Write-Err([string]$msg) {
  try { [Console]::Error.WriteLine($msg) } catch {}
}

function Try-FolderBrowserDialog([string]$initial) {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class User32 {
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@

  $topForm = New-Object System.Windows.Forms.Form
  $topForm.TopMost = $true
  $topForm.ShowInTaskbar = $false
  $topForm.FormBorderStyle = 'FixedToolWindow'
  $topForm.StartPosition = 'Manual'
  $topForm.Location = New-Object System.Drawing.Point(-32000, -32000)
  $topForm.Size = New-Object System.Drawing.Size(1, 1)
  $topForm.Opacity = 0
  $topForm.Show()
  $topForm.Activate()
  $topForm.BringToFront()
  $topForm.Focus()
  [User32]::SetForegroundWindow($topForm.Handle) | Out-Null
  [System.Windows.Forms.Application]::DoEvents()

  $dlg = New-Object System.Windows.Forms.FolderBrowserDialog
  $dlg.Description = 'Select project folder'
  if ($initial) { $dlg.SelectedPath = $initial }

  $result = $dlg.ShowDialog($topForm)
  $topForm.Close()

  if ($result -eq [System.Windows.Forms.DialogResult]::OK -and $dlg.SelectedPath) {
    return $dlg.SelectedPath
  }
  return $null
}

function Try-ShellBrowseForFolder([string]$initial) {
  $shell = New-Object -ComObject Shell.Application
  $root = 0
  if ($initial) { $root = $initial }
  $folder = $shell.BrowseForFolder(0, 'Select project folder', 0, $root)
  if ($folder -and $folder.Self -and $folder.Self.Path) {
    return $folder.Self.Path
  }
  return $null
}

try {
  $initial = ${initialDirectory ? `'${initialDirectory}'` : "''"}
  $path = $null
  try { $path = Try-FolderBrowserDialog $initial } catch {}
  if (-not $path) {
    try { $path = Try-ShellBrowseForFolder $initial } catch {}
  }
  if ($path) { Write-Output $path }
  exit 0
} catch {
  Write-Err ($_.Exception.Message)
  exit 1
}
`;

        const encoded = Buffer.from(script, "utf16le").toString("base64");

        const ps = spawn("powershell.exe", ["-NoProfile", "-STA", "-EncodedCommand", encoded]);
        let out = "";
        let errOut = "";
        ps.stdout.on("data", (d) => (out += d.toString()));
        ps.stderr.on("data", (d) => {
          const line = d.toString().trim();
          if (line) broadcast(`[browse stderr] ${line}`);
          errOut += `${line}\n`;
        });
        ps.on("error", (err) => reject(err));
        ps.on("exit", (code) => {
          const trimmed = out.trim();
          if (code === 0) return resolve(trimmed || null);
          const errTrimmed = errOut.trim();
          if (!trimmed && !errTrimmed) return resolve(null);
          if (!trimmed && errTrimmed.toLowerCase().includes("cancel")) return resolve(null);
          if (trimmed && fs.existsSync(trimmed)) return resolve(trimmed);
          reject(new Error(errTrimmed || "Folder selection cancelled or failed"));
        });
        return;
      }

      if (isMac) {
        const osa = spawn("osascript", [
          "-e",
          'set p to POSIX path of (choose folder with prompt "Select project folder")',
        ]);
        let out = "";
        let errOut = "";
        osa.stdout.on("data", (d) => (out += d.toString()));
        osa.stderr.on("data", (d) => {
          const line = d.toString().trim();
          if (line) broadcast(`[browse stderr] ${line}`);
          errOut += `${line}\n`;
        });
        osa.on("error", (err) => reject(err));
        osa.on("exit", (code) => {
          const trimmed = out.trim();
          if (code === 0) return resolve(trimmed || null);
          const errTrimmed = errOut.trim();
          if (!trimmed && errTrimmed.toLowerCase().includes("canceled")) return resolve(null);
          reject(new Error(errTrimmed || "Folder selection cancelled or failed"));
        });
        return;
      }

      if (isLinux) {
        const run = (command: string, args: string[], onMissing: () => void) => {
          const proc = spawn(command, args);
          let out = "";
          let errOut = "";
          proc.stdout.on("data", (d) => (out += d.toString()));
          proc.stderr.on("data", (d) => {
            const line = d.toString().trim();
            if (line) broadcast(`[browse stderr] ${line}`);
            errOut += `${line}\n`;
          });
          proc.on("error", (err: NodeJS.ErrnoException) => {
            if (err.code === "ENOENT") onMissing();
            else reject(err);
          });
          proc.on("exit", (code) => {
            const trimmed = out.trim();
            if (code === 0) return resolve(trimmed || null);
            const errTrimmed = errOut.trim();
            if (!trimmed && (code === 1 || code == null) && (!errTrimmed || errTrimmed.toLowerCase().includes("canceled"))) {
              return resolve(null);
            }
            reject(new Error(errTrimmed || "Folder selection cancelled or failed"));
          });
        };

        run(
          "zenity",
          [
            "--file-selection",
            "--directory",
            "--title=Select project folder",
            ...(defaultPath?.trim() ? [`--filename=${defaultPath}`] : []),
          ],
          () =>
            run(
              "kdialog",
              ["--getexistingdirectory", defaultPath?.trim() ? defaultPath : ".", "--title", "Select project folder"],
              () => reject(new Error("Folder picker not available (install zenity or kdialog, or enter the path manually).")),
            ),
        );
        return;
      }

      reject(new Error("Folder picker not supported on this OS"));
    });
  }

  async function handleBrowse(req: express.Request, res: express.Response) {
    try {
      const path = await browseFolder(parseBrowseDefaultPath(req));
      if (!path) return res.status(204).end();
      res.json({ path });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("cancel")) return res.status(204).end();
      res.status(400).json({ error: message });
    }
  }

  app.get("/api/events", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const id = randomUUID();
    clients.push({ id, res });
    logBuffer.forEach((line) => res.write(`data: ${line}\n\n`));
    req.on("close", () => {
      const idx = clients.findIndex((c) => c.id === id);
      if (idx >= 0) clients.splice(idx, 1);
    });
  });

  app.get("/api/status", (_req, res) => {
    res.json({
      running: Boolean(child),
      session: currentSession,
      artifacts: currentSession ? readArtifacts(currentSession.stateDir) : {},
    });
  });

  app.get("/api/sessions", (_req, res) => {
    let sessions: SessionRecord[] = [];
    if (fs.existsSync(sessionsFile)) {
      try {
        sessions = JSON.parse(fs.readFileSync(sessionsFile, "utf8"));
      } catch {
        sessions = [];
      }
    }
    res.json({ sessions });
  });

  app.post("/api/browse", express.text({ type: "*/*", limit: "64kb" }), handleBrowse);

  app.post("/api/start", jsonParser, (req, res) => {
    const { goal, maxIterations = 0, workdir = defaultWorkdir, createIfMissing = true } = req.body || {};
    if (!goal || typeof goal !== "string") {
      return res.status(400).json({ error: "goal is required" });
    }
    try {
      startSession(goal, Number(maxIterations) || 0, workdir, Boolean(createIfMissing));
      res.json({ ok: true, session: currentSession });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.method === "POST" && req.path === "/api/browse") {
      const status = typeof (err as any)?.status === "number" ? (err as any).status : undefined;
      const type = typeof (err as any)?.type === "string" ? (err as any).type : undefined;
      if (status === 400 && type === "entity.parse.failed") {
        return res.status(204).end();
      }
    }
    next(err);
  });

  app.post("/api/stop", (_req, res) => {
    stopSession();
    res.json({ ok: true });
  });

  app.get("/api/artifacts", (_req, res) => {
    if (!currentSession) return res.json({});
    res.json(readArtifacts(currentSession.stateDir));
  });

  return { app, stop: stopSession };
}

function listenOnce(app: express.Express, host: string, port: number): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => resolve(server));
    server.on("error", (err) => reject(err));
  });
}

export async function startServer(
  options: StartServerOptions = {},
): Promise<{ url: string; host: string; port: number; close: () => Promise<void> }> {
  const host = options.host ?? "127.0.0.1";
  const preferredPort = options.port ?? (process.env.PORT ? Number(process.env.PORT) : 4173);

  const ctx = createServerContext(options);

  let server: http.Server;
  try {
    server = await listenOnce(ctx.app, host, preferredPort);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EADDRINUSE" && preferredPort !== 0) {
      server = await listenOnce(ctx.app, host, 0);
    } else {
      throw err;
    }
  }

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : preferredPort;
  const url = `http://${host}:${port}`;

  const close = async () => {
    ctx.stop();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  };

  return { url, host, port, close };
}
