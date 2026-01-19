# Repository Guidelines

## Project Structure

- `src/cli.ts`: npm-installed CLI entrypoint (`milhouse`) with the yellow header.
- `ui/server.ts`: Express server for the local web UI; static assets live in `ui/public/` (copied to `dist/ui/public/` on build).
- `src/loop-runner.ts`: Node-based loop engine used by the UI (plan once, then iterate until `STATUS: DONE`).
- `prompts/*.md`: Prompt templates used by the loop runner (interpolate `{{GOAL}}` and `{{PLAN_PATH}}`).
- `dist/`: Compiled output (generated; not committed).

## Build, Test, and Development Commands

Prereqs: Node.js 18+.

```bash
npm install            # install deps
npm run typecheck      # tsc --noEmit
npm run build          # compile to dist/ and copy UI assets
npm run ui             # build + start web UI (local-only)
npm run dev -- ui      # run UI from TS via tsx
```

Installed usage (after publish):
```bash
npm install -g milhouse
milhouse ui
```

## Coding Style & Naming Conventions

- TypeScript ESM (NodeNext) with `strict` enabled.
- Match existing formatting: 2-space indentation, semicolons, double quotes.
- CLI flags use kebab-case (`--state-dir`, `--workdir`).

## Testing Guidelines

- No dedicated test suite yet. Validate with:
  - `npm run typecheck`
  - `npm run ui` and verify start/stop + live logs/artifacts

## Commit & Pull Request Guidelines

- Use Conventional Commits (`feat:`, `fix:`, `docs:`), e.g. `feat(ui): ...`.
- PRs should include: summary, local verification steps, and screenshots for UI changes.

## Security & Configuration Tips

- Never commit secrets. `CODEX_API_KEY` is optional (can fall back to local Codex auth if configured).
- State/logs default to the OS user data directory; override with `MILHOUSE_STATE_DIR` or `milhouse ui --state-dir <path>`.
