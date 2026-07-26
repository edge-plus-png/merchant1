import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createApplicationReturnState,
  verifyApplicationReturnState,
} from "@/lib/application-routing/return-state";
import { demoPortalStore, resetDemoState } from "@/lib/portal-store/demo-store";

vi.mock("server-only", () => ({}));

const now = new Date("2026-07-26T12:00:00.000Z");

describe("signed application return state", () => {
  beforeEach(() => {
    resetDemoState();
    vi.stubEnv(
      "APPLICATION_RETURN_STATE_SECRET",
      Buffer.alloc(32, 19).toString("base64"),
    );
  });
  afterEach(() => vi.unstubAllEnvs());

  it("accepts only a local canonical application entry path", () => {
    const state = createApplicationReturnState("/apps/events", now);
    expect(verifyApplicationReturnState(state, now)).toMatchObject({
      returnPath: "/apps/events",
    });
    expect(() =>
      createApplicationReturnState("https://attacker.example", now),
    ).toThrow();
    expect(() => createApplicationReturnState("/business", now)).toThrow();
  });

  it("rejects tampering and expiry", () => {
    const state = createApplicationReturnState("/apps/events", now);
    expect(verifyApplicationReturnState(`${state}x`, now)).toBeNull();
    expect(
      verifyApplicationReturnState(
        state,
        new Date(now.getTime() + 601_000),
      ),
    ).toBeNull();
  });

  it("consumes the signed nonce exactly once", async () => {
    const state = createApplicationReturnState("/apps/events", now);
    const payload = verifyApplicationReturnState(state, now)!;
    const input = {
      nonce: payload.nonce,
      expiresAt: new Date(payload.expiresAt * 1000),
    };

    await expect(
      demoPortalStore.consumeApplicationReturnStateNonce(input),
    ).resolves.toBe(true);
    await expect(
      demoPortalStore.consumeApplicationReturnStateNonce(input),
    ).resolves.toBe(false);
  });
});
