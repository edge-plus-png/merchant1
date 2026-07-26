import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

describe("Move handover browser history", () => {
  it("replaces the temporary GET entry with /apps before cross-origin submit", () => {
    const source = readFileSync("public/move-handover.js", "utf8");
    const submit = vi.fn();
    const replaceState = vi.fn();

    class TestForm {
      submit = submit;
    }

    runInNewContext(source, {
      document: { getElementById: () => new TestForm() },
      history: { replaceState },
      HTMLFormElement: TestForm,
    });

    expect(replaceState).toHaveBeenCalledWith(null, "", "/apps");
    expect(submit).toHaveBeenCalledOnce();
    expect(replaceState.mock.invocationCallOrder[0]).toBeLessThan(
      submit.mock.invocationCallOrder[0],
    );
  });
});
