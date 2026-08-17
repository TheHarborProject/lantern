import type { AuditEventSink } from "../lint/events.js";
import { formatDuration } from "../lint/render-lint-report.js";
import { createTerminalStyle } from "./terminal-style.js";

export interface LintProgressState {
  readonly phase: "planning" | "auditing" | "completed" | "failed" | "cancelled";
  readonly completedComponents: number;
  readonly totalComponents?: number;
  readonly currentComponent?: string;
  readonly elapsedMs: number;
}

interface ProgressWriter { write(text: string): unknown; }
interface Timer { readonly unref?: () => void; }

export interface LintProgressOptions {
  readonly writer: ProgressWriter;
  readonly standards: readonly string[];
  readonly color: boolean;
  readonly now?: () => number;
  readonly setInterval?: (callback: () => void, milliseconds: number) => Timer;
  readonly clearInterval?: (timer: Timer) => void;
}

export interface LintProgressController {
  readonly events: AuditEventSink;
  close(): void;
  state(): LintProgressState;
}

const STANDARD_LABELS: Readonly<Record<string, string>> = {
  "wcag22-aa": "WCAG 2.2 AA",
  "wcag21-aa": "WCAG 2.1 AA",
  "rgaa4.1": "RGAA 4.1",
};

/** Whether cursor-controlled progress is safe for this invocation. */
export function shouldRenderLintProgress(
  outputMode: "minimal" | "compact" | "verbose",
  isTTY: boolean,
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return outputMode !== "minimal" && isTTY && environment.CI === undefined;
}

/** Adapt semantic audit lifecycle events to one transient terminal block. */
export function createLintProgress(options: LintProgressOptions): LintProgressController {
  const now = options.now ?? Date.now;
  const schedule = options.setInterval ?? ((callback, milliseconds): Timer => setInterval(callback, milliseconds));
  const unschedule = options.clearInterval ?? ((timer): void => clearInterval(timer as NodeJS.Timeout));
  let startedAt = now();
  let completedComponents = 0;
  let totalComponents: number | undefined;
  let currentComponent: string | undefined;
  let phase: LintProgressState["phase"] = "planning";
  let renderedLines = 0;
  let closed = false;

  const snapshot = (): LintProgressState => ({
    phase,
    completedComponents,
    ...(totalComponents === undefined ? {} : { totalComponents }),
    ...(currentComponent === undefined ? {} : { currentComponent }),
    elapsedMs: Math.max(0, now() - startedAt),
  });

  const draw = (): void => {
    if (closed) return;
    const lines = renderLintProgress(snapshot(), options.standards, options.color);
    if (renderedLines === 0) options.writer.write("\u001b[?25l");
    else options.writer.write(`\u001b[${renderedLines}A`);
    options.writer.write(lines.map((line) => `\r\u001b[2K${line}\n`).join(""));
    renderedLines = lines.length;
  };

  const timer = schedule(draw, 100);
  timer.unref?.();

  const close = (): void => {
    if (closed) return;
    closed = true;
    unschedule(timer);
    if (renderedLines > 0) {
      options.writer.write(`\u001b[${renderedLines}A`);
      options.writer.write(Array.from({ length: renderedLines }, () => "\r\u001b[2K\n").join(""));
      options.writer.write(`\u001b[${renderedLines}A\r\u001b[?25h`);
    }
  };

  const events: AuditEventSink = (event) => {
    let changed = true;
    switch (event.type) {
      case "run-started":
        startedAt = Date.parse(event.timestamp);
        phase = "planning";
        break;
      case "run-planned":
        totalComponents = event.totalComponents;
        phase = "auditing";
        break;
      case "component-started":
        currentComponent = `${event.source}#${event.component}`;
        break;
      case "component-completed":
        completedComponents += 1;
        break;
      case "run-completed":
        phase = "completed";
        completedComponents = totalComponents ?? completedComponents;
        currentComponent = undefined;
        break;
      case "run-failed":
        phase = "failed";
        break;
      case "run-cancelled":
        phase = "cancelled";
        break;
      default:
        changed = false;
    }
    if (changed) draw();
  };

  return { events, close, state: snapshot };
}

export function renderLintProgress(state: LintProgressState, standards: readonly string[], color: boolean): readonly string[] {
  const style = createTerminalStyle(color);
  const standardNames = standards.map((standard) => STANDARD_LABELS[standard] ?? standard).join(", ") || "No standards";
  const lines = [style.strong("Lantern lint"), "", `${style.accent(style.strong(" RUN "))} ${style.strong(standardNames)}`, ""];
  if (state.phase === "planning" || state.totalComponents === undefined) {
    lines.push(` ${style.accent("Planning components…")}`, "", ` ${style.muted(`Elapsed   ${formatDuration(state.elapsedMs)}`)}`);
    return lines;
  }

  const total = state.totalComponents;
  const completed = Math.min(state.completedComponents, total);
  const percent = total === 0 ? 100 : Math.round((completed / total) * 100);
  const width = 20;
  const filled = total === 0 ? width : Math.round((completed / total) * width);
  const bar = `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
  lines.push(` ${style.strong("Auditing")}  ${style.accent(bar)}  ${completed}/${total} components  ${percent}%`);
  lines.push(state.currentComponent === undefined ? "" : ` ${style.strong("Current")}   ${style.strong(state.currentComponent)}`);
  lines.push(` ${style.strong("Elapsed")}   ${style.muted(formatDuration(state.elapsedMs))}`);
  return lines;
}
