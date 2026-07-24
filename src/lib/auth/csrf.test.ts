import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "@/lib/auth/csrf";

describe("same-origin form protection", () => {
  it("accepts a matching origin and host", () => {
    const request = new Request("https://portal.example/api/auth/login", {
      headers: { host: "portal.example", origin: "https://portal.example" },
    });
    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("rejects a cross-origin request", () => {
    const request = new Request("https://portal.example/api/auth/login", {
      headers: { host: "portal.example", origin: "https://attacker.example" },
    });
    expect(isSameOriginRequest(request)).toBe(false);
  });
});
