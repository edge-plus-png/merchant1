import { describe, expect, it } from "vitest";
import { generateTotpCode, verifyTotpCode } from "@/lib/hq-auth/mfa";

describe("HQ TOTP MFA", () => {
  const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

  it("generates and verifies the RFC 6238 counter value", () => {
    const now = new Date(59_000);
    expect(generateTotpCode(rfcSecret, now)).toBe("287082");
    expect(verifyTotpCode(rfcSecret, "287082", now)).toBe(true);
  });

  it("allows one adjacent time window and rejects malformed codes", () => {
    const code = generateTotpCode(rfcSecret, new Date(60_000));
    expect(verifyTotpCode(rfcSecret, code, new Date(90_000))).toBe(true);
    expect(verifyTotpCode(rfcSecret, "12345", new Date(60_000))).toBe(false);
    expect(verifyTotpCode(rfcSecret, "abcdef", new Date(60_000))).toBe(false);
  });
});
