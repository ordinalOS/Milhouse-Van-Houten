import { Codex, type ApprovalMode, type SandboxMode, type ThreadOptions } from "@openai/codex-sdk";

export type RunTurnOptions = {
  promptText: string;
  workdir: string;
  threadId?: string;
  additionalDirectories?: string[];
  sandboxMode?: SandboxMode;
  approvalPolicy?: ApprovalMode;
  skipGitRepoCheck?: boolean;
  networkAccessEnabled?: boolean;
  webSearchEnabled?: boolean;
};

export type RunTurnResult = {
  threadId: string | null;
  finalResponse: string;
  items: unknown[];
  usage: unknown;
};

export async function runTurn(options: RunTurnOptions): Promise<RunTurnResult> {
  const apiKey = process.env.CODEX_API_KEY;
  const codex = apiKey ? new Codex({ apiKey }) : new Codex();

  const threadOptions: ThreadOptions = {
    workingDirectory: options.workdir,
    sandboxMode: options.sandboxMode,
    approvalPolicy: options.approvalPolicy,
    skipGitRepoCheck: options.skipGitRepoCheck ?? true,
    additionalDirectories: options.additionalDirectories,
    networkAccessEnabled: options.networkAccessEnabled,
    webSearchEnabled: options.webSearchEnabled,
  };

  const thread = options.threadId
    ? codex.resumeThread(options.threadId, threadOptions)
    : codex.startThread(threadOptions);

  const turn = await thread.run(options.promptText);

  return {
    threadId: thread.id,
    finalResponse: turn.finalResponse,
    items: turn.items,
    usage: turn.usage,
  };
}

