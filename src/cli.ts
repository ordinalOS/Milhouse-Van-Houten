#!/usr/bin/env node
import path from "node:path";
import open from "open";
import { printMilhouseHeader } from "./banner.js";
import { startServer } from "../ui/server.js";

type UiOptions = {
  host: string;
  port: number;
  workdir: string;
  stateDir?: string;
  openBrowser: boolean;
};

function printHelp(): void {
  const help = [
    "Usage:",
    "  milhouse ui [--workdir <path>] [--port <n>] [--host <ip>] [--state-dir <path>] [--no-open]",
    "",
    "Examples:",
    "  milhouse ui --workdir .",
    "  milhouse ui --port 4173",
  ];
  process.stdout.write(`${help.join("\n")}\n`);
}

function parseUiOptions(argv: string[]): UiOptions {
  let host = "127.0.0.1";
  let port = 4173;
  let workdir = process.cwd();
  let stateDir: string | undefined;
  let openBrowser = true;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      case "--host": {
        const value = argv[i + 1];
        if (!value) throw new Error("Missing value for --host");
        host = value;
        i += 1;
        break;
      }
      case "--port":
      case "-p": {
        const value = argv[i + 1];
        if (!value) throw new Error("Missing value for --port");
        port = Number(value);
        if (!Number.isFinite(port) || port < 0 || port > 65535) throw new Error(`Invalid port: ${value}`);
        i += 1;
        break;
      }
      case "--workdir":
      case "-w": {
        const value = argv[i + 1];
        if (!value) throw new Error("Missing value for --workdir");
        workdir = path.resolve(value);
        i += 1;
        break;
      }
      case "--state-dir": {
        const value = argv[i + 1];
        if (!value) throw new Error("Missing value for --state-dir");
        stateDir = path.resolve(value);
        i += 1;
        break;
      }
      case "--open":
        openBrowser = true;
        break;
      case "--no-open":
        openBrowser = false;
        break;
      default:
        throw new Error(`Unknown arg: ${arg}`);
    }
  }

  return { host, port, workdir, stateDir, openBrowser };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cmd = argv[0];

  if (!cmd || cmd === "--help" || cmd === "-h") {
    printMilhouseHeader();
    printHelp();
    return;
  }

  if (cmd !== "ui") {
    printMilhouseHeader();
    throw new Error(`Unknown command: ${cmd}`);
  }

  const options = parseUiOptions(argv.slice(1));

  printMilhouseHeader();
  const { url } = await startServer({
    host: options.host,
    port: options.port,
    defaultWorkdir: options.workdir,
    stateBaseDir: options.stateDir,
  });

  process.stdout.write(`Milhouse panel running at ${url}\n`);
  if (options.openBrowser) {
    try {
      await open(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Failed to open browser: ${message}\n`);
    }
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
