#!/usr/bin/env node
import fs from "node:fs";
import { Codex, type ThreadOptions } from "@openai/codex-sdk";

type ParsedArgs = {
  prompt: string;
  promptFile?: string;
  threadId?: string;
  workdir?: string;
  stream: boolean;
  logFile?: string;
  json: boolean;
};

function printUsage(): void {
  const usage = [
    "Usage: npm run codex -- \"<prompt>\" [--thread <id>] [--workdir <path>] [--json] [--stream] [--log-file <path>]",
    "   or: npm run codex -- --prompt-file <path> [--thread <id>] [--workdir <path>] [--json] [--stream] [--log-file <path>]",
    "",
    "Options:",
    "      --prompt-file <path>  Read prompt from file",
    "  -t, --thread <id>   Resume an existing Codex thread",
    "  -w, --workdir <path> Working directory for the agent (defaults to current)",
    "      --stream        Stream Codex events to stderr",
    "      --log-file <path> Write final JSON to a file",
    "      --json          Print JSON (response, items, usage, threadId)",
    "  -h, --help          Show this help text",
  ];
  console.log(usage.join("\n"));
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0) {
    printUsage();
    process.exit(1);
  }

  let threadId: string | undefined;
  let promptFile: string | undefined;
  let workdir: string | undefined;
  let stream = false;
  let logFile: string | undefined;
  let json = false;
  const promptParts: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--prompt-file": {
        const value = argv[i + 1];
        if (!value) {
          console.error("Missing value for --prompt-file");
          process.exit(1);
        }
        promptFile = value;
        i += 1;
        break;
      }
      case "--log-file": {
        const value = argv[i + 1];
        if (!value) {
          console.error("Missing value for --log-file");
          process.exit(1);
        }
        logFile = value;
        i += 1;
        break;
      }
      case "--stream":
        stream = true;
        break;
      case "-t":
      case "--thread": {
        const value = argv[i + 1];
        if (!value) {
          console.error("Missing value for --thread");
          process.exit(1);
        }
        threadId = value;
        i += 1;
        break;
      }
      case "-w":
      case "--workdir": {
        const value = argv[i + 1];
        if (!value) {
          console.error("Missing value for --workdir");
          process.exit(1);
        }
        workdir = value;
        i += 1;
        break;
      }
      case "--json":
        json = true;
        break;
      case "-h":
      case "--help":
        printUsage();
        process.exit(0);
      default:
        promptParts.push(arg);
    }
  }

  const prompt = promptParts.join(" ").trim();
  return { prompt, promptFile, threadId, workdir, stream, logFile, json };
}

async function main(): Promise<void> {
  const { prompt, promptFile, threadId, workdir, stream, logFile, json } = parseArgs(process.argv.slice(2));

  const promptText =
    promptFile != null
      ? fs.readFileSync(promptFile, "utf8")
      : prompt;

  if (!promptText.trim()) {
    console.error("Prompt is required (inline or via --prompt-file).");
    printUsage();
    process.exit(1);
  }

  const apiKey = process.env.CODEX_API_KEY;

  const threadOptions: ThreadOptions = {
    workingDirectory: workdir ?? process.cwd(),
    approvalPolicy: "never",
    sandboxMode: "danger-full-access",
    skipGitRepoCheck: true,
  };

  const codex = apiKey ? new Codex({ apiKey }) : new Codex();
  const thread = threadId
    ? codex.resumeThread(threadId, threadOptions)
    : codex.startThread(threadOptions);

  if (stream) {
    const streamed = await thread.runStreamed(promptText);
    let lastAgent = "";
    let usage: unknown = null;
    const items: unknown[] = [];

    for await (const event of streamed.events) {
      // Log event summaries to stderr
      if ("type" in event) {
        if (event.type === "item.completed" && "item" in event && event.item?.type === "agent_message") {
          const text = (event.item as any).text ?? "";
          lastAgent = text || lastAgent;
          console.error(`[agent] ${text}`);
        } else if (event.type === "item.completed" && "item" in event) {
          console.error(`[item.completed] ${event.item.type ?? "unknown"}`);
        } else if (event.type === "turn.completed") {
          usage = (event as any).usage ?? usage;
          console.error(`[turn.completed] usage recorded`);
        } else {
          console.error(`[${event.type}]`);
        }
        // Collect items if present
        if ((event as any).item) {
          items.push((event as any).item);
        }
      }
    }

    const result = {
      threadId: thread.id,
      finalResponse: lastAgent,
      items,
      usage,
    };

    const jsonOut = JSON.stringify(result, null, 2);
    if (logFile) {
      fs.writeFileSync(logFile, jsonOut, "utf8");
    }
    if (json) {
      console.log(jsonOut);
    } else {
      console.log(lastAgent);
      if (thread.id) {
        console.error(`thread: ${thread.id}`);
      }
    }
    return;
  }

  const turn = await thread.run(promptText);
  const currentThreadId = thread.id;

  const output = {
    threadId: currentThreadId,
    finalResponse: turn.finalResponse,
    items: turn.items,
    usage: turn.usage,
  };

  if (logFile) {
    fs.writeFileSync(logFile, JSON.stringify(output, null, 2), "utf8");
  }

  if (json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(turn.finalResponse);
    if (currentThreadId) {
      console.error(`thread: ${currentThreadId}`);
    }
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Codex run failed: ${message}`);
  process.exit(1);
});
