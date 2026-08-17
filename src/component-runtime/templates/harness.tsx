import { Component, StrictMode, createElement, useEffect, type ComponentType, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

interface LanternWindow {
  __lanternMounted__?: boolean;
  __lanternError__?: string | undefined;
  __lanternProps__?: Record<string, unknown>;
  addEventListener(type: "error", listener: (event: { readonly error?: unknown; readonly message?: string }) => void): void;
}

interface HarnessInput {
  readonly component: ComponentType<Record<string, unknown>>;
  readonly wrapper?: ComponentType<{ readonly children?: ReactNode }> | undefined;
}

export function mountLanternHarness(input: HarnessInput): void {
  const lanternWindow = globalThis as unknown as LanternWindow;
  lanternWindow.__lanternMounted__ = false;
  lanternWindow.__lanternError__ = undefined;

  lanternWindow.addEventListener("error", (event) => reportError(event.error || event.message));

  try {
    const container = (globalThis as unknown as { readonly document: { getElementById(id: string): unknown } }).document.getElementById("root");
    if (container === null) {
      reportError("Lantern isolation root '#root' was not found.");
      return;
    }

    const props = lanternWindow.__lanternProps__ ?? {};
    const rendered = createElement(input.component, props);
    const wrapped = input.wrapper === undefined ? rendered : createElement(input.wrapper, null, rendered);
    const tree = createElement(
      StrictMode,
      null,
      createElement(LanternBoundary as unknown as ComponentType<{ readonly children?: ReactNode }>, null, wrapped),
      createElement(LanternReady),
    );
    createRoot(container).render(tree);
  } catch (error) {
    reportError(error);
  }
}

function reportError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const lanternWindow = globalThis as unknown as LanternWindow;
  if (lanternWindow.__lanternError__ === undefined) {
    lanternWindow.__lanternError__ = message;
  }
}

class LanternBoundary extends Component<{ readonly children?: ReactNode }> {
  override componentDidCatch(error: unknown): void {
    reportError(error);
  }

  override render(): ReactNode {
    return this.props.children;
  }
}

function LanternReady(): null {
  useEffect(() => {
    (globalThis as unknown as LanternWindow).__lanternMounted__ = true;
  }, []);
  return null;
}
