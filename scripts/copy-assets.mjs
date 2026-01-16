import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

async function copyDir(from, to) {
  await fs.mkdir(to, { recursive: true });
  await fs.cp(from, to, { recursive: true, force: true });
}

async function main() {
  const uiPublicSrc = path.join(rootDir, "ui", "public");
  const uiPublicDest = path.join(rootDir, "dist", "ui", "public");
  await copyDir(uiPublicSrc, uiPublicDest);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

