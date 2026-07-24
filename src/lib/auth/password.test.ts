import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("accepts the original password and rejects another", async () => {
    const hash = await hashPassword("OwnerPass123!");

    await expect(verifyPassword("OwnerPass123!", hash)).resolves.toBe(true);
    await expect(verifyPassword("not-the-password", hash)).resolves.toBe(false);
  });

  it("fails closed for malformed hashes", async () => {
    await expect(verifyPassword("anything", "malformed")).resolves.toBe(false);
  });
});
