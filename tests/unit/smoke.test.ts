import { describe, expect, it } from "vitest";

describe("test setup", () => {
  it("provides a DOMParser through happy-dom", () => {
    const doc = new DOMParser().parseFromString(
      "<section data-mw-section-id='0'></section>",
      "text/html",
    );
    expect(doc.querySelector("section")?.getAttribute("data-mw-section-id")).toBe("0");
  });
});
