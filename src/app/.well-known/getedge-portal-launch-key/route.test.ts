import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/surface", () => ({
  requireRequestSurface: () => true,
}));

import { GET } from "@/app/.well-known/getedge-portal-launch-key/route";

const privateKey = [
  "-----BEGIN PRIVATE KEY-----",
  "MC4CAQAwBQYDK2VwBCIEIGB5JbxemxHwpdQwBWOL+vaK3sl3gAb+kQAoRSww404N",
  "-----END PRIVATE KEY-----",
  "",
].join("\n");

describe("Portal capability signing key endpoint", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("publishes the current Ed25519 public key without caching", async () => {
    vi.stubEnv("CAPABILITY_LAUNCH_PRIVATE_KEY", privateKey);
    vi.stubEnv("CAPABILITY_LAUNCH_KEY_ID", "portal-capability-test-1");

    const response = await GET(
      new Request(
        "https://merchant.example/.well-known/getedge-portal-launch-key",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      algorithm: "Ed25519",
      keyId: "portal-capability-test-1",
      publicKey: [
        "-----BEGIN PUBLIC KEY-----",
        "MCowBQYDK2VwAyEAX5tH9deXm2Zsh5Mnz46wHWtfT7n9GmJUoEyfsMlXKCk=",
        "-----END PUBLIC KEY-----",
        "",
      ].join("\n"),
    });
  });
});
