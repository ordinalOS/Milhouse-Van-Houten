import figlet from "figlet";

const ANSI_BRIGHT_YELLOW = "\u001B[93m";
const TRUECOLOR_YELLOW = "\u001B[38;2;255;255;0m";
const RESET = "\u001B[0m";

const BANNER_TEXT = "MILLHOUSE";
const CONTACT_LINE = "github.com/millhouse/millhouse";
const SEPARATOR_CHAR = "─";

function useColor(): boolean {
  return Boolean(process.stdout.isTTY) && process.env.NO_COLOR == null;
}

function supportsTruecolor(): boolean {
  const colorterm = process.env.COLORTERM?.toLowerCase();
  return colorterm === "truecolor" || colorterm === "24bit" || colorterm?.includes("truecolor") === true;
}

const DRAGON_ART = [
  "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⡤⣄⡀⠀⠀⠀⠀⠀⢀⣠⠖⠒⢦⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡼⠃⠀⠀⠉⠑⠦⣄⣀⡾⠋⠀⠀⠀⠀⢳⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣸⠃⠀⠀⠀⠀⠀⠀⠀⠉⠀⠀⠀⠀⠀⠀⠀⢇⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⣀⣠⠤⠤⠒⠒⠒⠛⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⠒⠦⠤⢄⣀⡀⠀⠀⠀",
  "⠀⠀⠀⡟⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣷⠀⠀⠀",
  "⠀⠀⠀⢧⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⡟⠀⠀⠀",
  "⠀⠀⠀⠘⣧⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣼⠁⠀⠀⠀",
  "⠀⠀⢀⣠⠼⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠲⣄⠀⠀",
  "⢀⡴⠛⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢳⠄",
  "⢿⡁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⡀⢀⠀⠀⠀⠀⠀⠀⠀⠀⡄⠀⠀⣠⠞⠀",
  "⠀⠳⣄⠀⠀⠀⠀⠀⠀⠀⠀⢰⡿⢆⠀⠐⣦⡀⠰⡄⠀⠈⡧⣟⠀⠀⢰⡆⢀⣴⠀⢀⣹⣀⣾⠁⠀⠀",
  "⠀⠀⠈⢳⡄⠀⠀⠀⠀⠀⠘⠳⣷⡤⠿⠚⠛⠟⠛⠛⠓⣶⠃⠸⢶⣺⣟⠋⠻⠋⠉⢛⡿⠛⢹⡆⠀⠀",
  "⠀⠀⠀⡞⠁⠀⠀⠀⠀⠀⠀⠀⠀⠙⢦⣤⡤⠤⠤⢶⡾⠋⠀⠀⠀⠀⠀⠹⡦⢤⣶⡟⢀⣠⠿⠃⠀⠀",
  "⠀⠀⣾⠁⠀⠀⠀⠀⠀⢀⣶⣶⠲⠄⠀⠈⠁⠀⠀⠀⠀⠀⠀⢠⣄⣀⣤⠾⠃⠀⠈⢿⠉⠀⠀⠀⠀⠀",
  "⠀⠀⠻⣄⠀⠀⠀⠀⠀⢻⣍⡏⣗⠀⠀⠀⠀⠀⠀⠀⠀⢀⣤⠾⠒⠒⢦⡀⠀⠀⠀⠈⢧⡀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠉⠑⠲⣦⠀⠀⠉⠛⡟⠀⠀⠀⠀⠀⠀⣠⡶⠋⠀⠀⠀⠀⠀⠻⡄⠀⠀⠀⢘⡇⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⠀⢿⣀⣀⣀⣠⣷⠀⠀⠀⠀⢀⣴⡏⠀⠀⠀⠀⠀⠀⠀⠀⠽⣦⠤⠒⠛⠁⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⠀⠀⠉⠀⠀⣀⠼⣄⠀⠀⠀⣿⣸⡿⣆⠀⠀⠀⠀⠀⠀⠀⠀⠙⣆⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠐⣯⠀⣸⠋⠓⣾⠋⢹⡿⢿⣆⠀⠀⠀⠀⠀⠀⠀⠀⠘⣦⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣰⠋⠉⠛⠦⣼⠁⠀⠀⠐⠖⠻⣧⠀⠀⠀⢀⣠⠴⠖⠛⢻⠂⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⠇⠀⠀⠀⢀⡇⠀⠀⠀⠀⢰⡞⠾⡇⠀⣴⠋⠀⠀⢀⡼⠋⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⠀⠀⠀⡟⠀⠀⠀⢀⡼⠁⠀⠀⠀⠀⣿⣿⠾⠿⣬⣥⡤⠤⠞⠋⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⠀⠀⢰⠃⠀⠀⢠⠞⠁⠀⠀⠀⢠⡾⠁⠀⠀⠀⠈⣿⢧⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⠀⠀⣾⠀⠀⠀⠉⠀⠀⠀⠀⠀⣼⠀⠀⠀⠀⠀⠀⢿⠘⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⠀⢠⣿⡄⠀⠀⠀⠀⠀⠀⠀⢠⠏⠀⠀⠀⠀⠀⠀⣾⠀⢻⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⠀⣼⠀⢷⡀⠀⠀⠀⠀⠀⣰⠏⠀⠀⠀⠀⠀⠀⠀⢿⡇⠀⢇⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⢀⡯⠀⠈⠳⢤⣤⡤⠴⠚⠁⠀⠀⠀⠀⠀⠀⠀⠀⠘⣇⠀⠸⡄⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⢸⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢹⡀⠀⢻⡀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⣾⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⣧⢀⣼⠃⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⠘⢧⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣤⡿⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⠀⠀⠉⠛⠲⠶⠤⠤⠤⣤⣤⡤⠤⠤⠤⠶⠖⠒⠛⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
];

function rtrim(value: string): string {
  return value.replace(/\s+$/u, "");
}

function padLines(lines: string[], length: number): string[] {
  if (lines.length >= length) return lines;
  return [...lines, ...Array.from({ length: length - lines.length }, () => "")];
}

function maxWidth(lines: string[]): number {
  return lines.reduce((acc, line) => Math.max(acc, line.length), 0);
}

function padRight(value: string, width: number): string {
  return value.padEnd(width, " ");
}

function makeSeparator(width: number): string {
  if (width <= 0) return "";
  return SEPARATOR_CHAR.repeat(width);
}

export function getMillhouseHeader(): string {
  const bannerLines = figlet
    .textSync(BANNER_TEXT, { font: "ANSI Shadow" })
    .trimEnd()
    .split("\n")
    .map(rtrim);
  const allLines = [...DRAGON_ART, "", ...bannerLines];
  const width = maxWidth([...allLines, CONTACT_LINE]);
  const sep = makeSeparator(width);

  if (!useColor()) {
    const combined = allLines.join("\n");
    return `${combined}\n${sep}\n${CONTACT_LINE}\n${sep}\n`;
  }

  const truecolor = supportsTruecolor();
  const color = truecolor ? TRUECOLOR_YELLOW : ANSI_BRIGHT_YELLOW;
  const lineColor = color;

  const coloredLines = allLines.map((line) => `${color}${line}${RESET}`);

  return `${coloredLines.join("\n")}\n${lineColor}${sep}${RESET}\n${lineColor}${CONTACT_LINE}${RESET}\n${lineColor}${sep}${RESET}\n`;
}

export function printMillhouseHeader(): void {
  process.stdout.write(getMillhouseHeader());
}
