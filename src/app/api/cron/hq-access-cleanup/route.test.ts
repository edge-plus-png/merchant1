import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cleanup: vi.fn(),
}));

vi.mock("@/lib/hq-access/cleanup", () => ({
  runHQAccessCleanup: mocks.cleanup,
}));

import { GET } from "@/app/api/cron/hq-access-cleanup/route";

function cleanupRequest(secret?: string) {
  return new Request("https://merchant.example/api/cron/hq-access-cleanup", {
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
  });
}

describe("HQ access cleanup cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "cron-test-secret");
    mocks.cleanup.mockResolvedValue({
      expiredSupportSessionsDeleted: 2,
      oldConsumedNoncesDeleted: 3,
      nonceRetentionDays: 30,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects requests without the configured bearer secret", async () => {
    const response = await GET(cleanupRequest());

    expect(response.status).toBe(401);
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });

  it("returns and logs only concise operational counts", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const response = await GET(cleanupRequest("cron-test-secret"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      expiredSupportSessionsDeleted: 2,
      oldConsumedNoncesDeleted: 3,
      nonceRetentionDays: 30,
    });
    expect(log).toHaveBeenCalledWith(
      JSON.stringify({
        event: "hq_access_cleanup_completed",
        expiredSupportSessionsDeleted: 2,
        oldConsumedNoncesDeleted: 3,
        nonceRetentionDays: 30,
      }),
    );
  });
});
