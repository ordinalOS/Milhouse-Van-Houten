import envPaths from "env-paths";
import path from "node:path";

export function resolveStateBaseDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.MILLHOUSE_STATE_DIR?.trim();
  if (override) return path.resolve(override);

  const paths = envPaths("millhouse");
  return paths.data;
}

export function resolveDefaultWorkdir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.MILLHOUSE_DEFAULT_WORKDIR?.trim();
  if (override) return path.resolve(override);
  return process.cwd();
}

