import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "../../src/ui/ErrorBoundary.tsx";

function Broken(): never {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  it("shows a friendly message instead of a blank screen", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <ErrorBoundary>
          <Broken />
        </ErrorBoundary>,
      );
    });
    expect(host.textContent).toContain("This map couldn’t be drawn.");
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    await act(async () => root.unmount());
    quiet.mockRestore();
  });
});
