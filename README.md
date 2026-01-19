# Millhouse

![Millhouse](millhouse.png)

Millhouse is a chad pair programmer that provides a lightweight web UI for running Codex threads, starting with a quick planning phase and iterating through builds until the job is done. Inspired by a Ralph Wiggum–style autonomous loop, Millhouse focuses on simplicity, approachability, and making experimentation fun and easy to modify.

This repository contains the **bare-bones** version of Millhouse. It represents the core foundation, with many new features, experiments, and feedback loops currently in the pipeline.

## Features

* Web UI for managing Codex runs
* Ralph Wiggum–style autonomous loop system: plan once, then iterate builds until done
* Live logs via Server-Sent Events (SSE)
* Session history with status tracking
* Cross-platform folder picker (Windows, macOS, Linux)

## Prerequisites

* Node.js 18+
* `CODEX_API_KEY` set in your environment **(optional if your Codex CLI is already authenticated)**

## Install

```bash
npm install -g millhouse
```

## Usage

Start the Web UI:

```bash
millhouse ui
```

This opens a local web panel at `http://127.0.0.1:4173` (falls back to a free port if busy).

### CLI Options

```text
millhouse ui [OPTIONS]

Options:
  --host <ip>           Server host (default: 127.0.0.1)
  --port <n>, -p <n>    Server port (default: 4173)
  --workdir <path>, -w  Working directory for Codex (default: current directory)
  --state-dir <path>    State/logs directory (default: OS user data directory)
  --no-open             Don't auto-open browser
  --help, -h            Show help
```

### Examples

```bash
# Start with default settings
millhouse ui

# Specify a project directory
millhouse ui --workdir /path/to/project

# Use a custom port
millhouse ui --port 8080

# Don't auto-open browser
millhouse ui --no-open
```

## How It Works

1. **Plan Phase**: Enter a goal in the Web UI. Millhouse generates an `IMPLEMENTATION_PLAN.md` with prioritized tasks.
2. **Build Loop**: Millhouse iteratively executes tasks from the plan, updating progress after each iteration.
3. **Completion**: When all tasks are done, the plan is marked `STATUS: DONE` and the loop exits.

## Web UI Features

* **Hero Status**: Shows current run status and thread ID
* **Controls**: Start/stop runs, set goals and max iterations
* **Live Logs**: Real-time log streaming with auto-scroll
* **Artifacts**: View plan output, build logs, and implementation plan
* **Sessions**: History of all runs with status, timestamps, and durations

## Development

```bash
# Clone the repository
git clone https://github.com/ordinalOS/millhouse.git
cd millhouse

# Install dependencies
npm install

# Run in development mode
npm run dev -- ui

# Build for production
npm run build

# Run built version
npm run ui
```

## Environment Variables

* `CODEX_API_KEY`: OpenAI Codex API key (optional if using local Codex auth)
* `MILLHOUSE_STATE_DIR`: Override default state directory
* `MILLHOUSE_DEFAULT_WORKDIR`: Override default working directory

## How to Contribute

Thank you for considering contributing to Millhouse! This repository is intentionally open-ended, and we welcome contributions of all kinds — including bug fixes, enhancements, documentation improvements, new loops, unconventional experiments, and wild ideas.

If you have something you want to try, this is the place to do it. Fork the repository, explore freely, and open a pull request when you’re ready. No idea is a bad idea. Creativity encouraged.

MIT License — see [LICENSE](LICENSE) for details.
