import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("application handover browser history", () => {
  it("uses fetch before navigating so a POST is not left in browser history", () => {
    const source = readFileSync("public/application-handover.js", "utf8");

    expect(source).toContain("await fetch(handoverForm.action");
    expect(source).toContain('history.replaceState(null, "", "/apps")');
    expect(source).toContain("window.location.assign(response.url)");
    expect(source).toContain(
      'document.body.dataset.handoverState = "failed"',
    );
    expect(source).not.toContain("window.location.assign(handoverForm.action)");
  });
});
