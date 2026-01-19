import envPaths from "env-paths";
import fs from "node:fs";
import path from "node:path";

export function resolveStateBaseDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.MILHOUSE_STATE_DIR?.trim() || env.MILLHOUSE_STATE_DIR?.trim();
  if (override) return path.resolve(override);

  const newDir = envPaths("milhouse").data;
  const oldDir = envPaths("millhouse").data;
  if (fs.existsSync(oldDir) && !fs.existsSync(newDir)) return oldDir;
  return newDir;
}

export function resolveDefaultWorkdir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.MILHOUSE_DEFAULT_WORKDIR?.trim() || env.MILLHOUSE_DEFAULT_WORKDIR?.trim();
  if (override) return path.resolve(override);
  return process.cwd();
}
