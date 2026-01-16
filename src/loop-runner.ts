import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTurn } from "./codexRun.js";

type Args = {
  goal: string;
  maxIterations: number;
  workdir: string;
  stateDir: string;
};

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function parseArgs(argv: string[]): Args {
  let goal = "";
  let maxIterations = 0;
  let workdir = process.cwd();
  let stateDir = "";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--goal": {
        const value = argv[i + 1];
        if (!value) fail("Missing value for --goal");
        goal = value;
        i += 1;
        break;
      }
      case "--max-iterations": {
        const value = argv[i + 1];
        if (!value) fail("Missing value for --max-iterations");
        maxIterations = Number(value) || 0;
        i += 1;
        break;
      }
      case "--workdir": {
        const value = argv[i + 1];
        if (!value) fail("Missing value for --workdir");
        workdir = path.resolve(value);
        i += 1;
        break;
      }
      case "--state-dir": {
        const value = argv[i + 1];
        if (!value) fail("Missing value for --state-dir");
        stateDir = path.resolve(value);
        i += 1;
        break;
      }
      default:
        fail(`Unknown arg: ${arg}`);
    }
  }

  if (!goal.trim()) fail("--goal is required");
  if (!stateDir) fail("--state-dir is required");
  return { goal, maxIterations, workdir, stateDir };
}

function replaceAll(template: string, replacements: Record<string, string>): string {
  let next = template;
  for (const [key, value] of Object.entries(replacements)) {
    next = next.replaceAll(key, value);
  }
  return next;
}

function renderPrompt(templatePath: string, outputPath: string, replacements: Record<string, string>) {
  const template = fs.readFileSync(templatePath, "utf8");
  const rendered = replaceAll(template, replacements);
  fs.writeFileSync(outputPath, rendered, "utf8");
}

function readTextIfExists(p: string): string | null {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function findPackageRoot(fromDir: string): string {
  const candidates = [
    // When running from `src/`
    path.resolve(fromDir, ".."),
    // When running from `dist/src/`
    path.resolve(fromDir, "..", ".."),
  ];

  for (const candidate of candidates) {
    const plan = path.join(candidate, "prompts", "plan.md");
    const build = path.join(candidate, "prompts", "build.md");
    if (fs.existsSync(plan) && fs.existsSync(build)) {
      return candidate;
    }
  }

  return path.resolve(fromDir, "..", "..");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  fs.mkdirSync(args.stateDir, { recursive: true });

  const threadFile = path.join(args.stateDir, "thread_id");
  const planRendered = path.join(args.stateDir, "plan_prompt.md");
  const buildRendered = path.join(args.stateDir, "build_prompt.md");
  const planOut = path.join(args.stateDir, "plan_out.log");
  const buildOut = path.join(args.stateDir, "build_out.log");
  const planPath = path.join(args.stateDir, "IMPLEMENTATION_PLAN.md");

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = findPackageRoot(__dirname);
  const planTemplate = path.join(packageRoot, "prompts", "plan.md");
  const buildTemplate = path.join(packageRoot, "prompts", "build.md");

  const replacements = {
    "{{GOAL}}": args.goal,
    "{{PLAN_PATH}}": planPath,
  };

  renderPrompt(planTemplate, planRendered, replacements);

  const planPromptText = fs.readFileSync(planRendered, "utf8");
  const planResult = await runTurn({
    promptText: planPromptText,
    workdir: args.workdir,
    threadId: undefined,
    additionalDirectories: [args.stateDir],
    sandboxMode: "workspace-write",
    approvalPolicy: "never",
    skipGitRepoCheck: true,
  });

  fs.writeFileSync(planOut, JSON.stringify(planResult, null, 2), "utf8");

  if (planResult.threadId) {
    fs.writeFileSync(threadFile, planResult.threadId, "utf8");
    process.stdout.write(`thread: ${planResult.threadId}\n`);
  }

  renderPrompt(buildTemplate, buildRendered, replacements);
  const buildPromptText = fs.readFileSync(buildRendered, "utf8");

  let iter = 0;
  while (true) {
    if (args.maxIterations > 0 && iter >= args.maxIterations) {
      process.stdout.write(`Reached max iterations: ${args.maxIterations}\n`);
      break;
    }

    const tid = readTextIfExists(threadFile)?.trim();
    const buildResult = await runTurn({
      promptText: buildPromptText,
      workdir: args.workdir,
      threadId: tid || undefined,
      additionalDirectories: [args.stateDir],
      sandboxMode: "workspace-write",
      approvalPolicy: "never",
      skipGitRepoCheck: true,
    });

    fs.writeFileSync(buildOut, JSON.stringify(buildResult, null, 2), "utf8");

    if (buildResult.threadId) {
      fs.writeFileSync(threadFile, buildResult.threadId, "utf8");
      process.stdout.write(`thread: ${buildResult.threadId}\n`);
    }

    const planText = readTextIfExists(planPath) ?? "";
    if (/STATUS:\s*DONE\b/.test(planText)) {
      process.stdout.write("Plan marked DONE. Exiting.\n");
      break;
    }

    iter += 1;
    process.stdout.write(`================ LOOP ${iter} ================\n`);
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
