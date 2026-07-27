import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeNonce: vi.fn(),
  createSession: vi.fn(),
  findLocalBusiness: vi.fn(),
  findLoginMembership: vi.fn(),
  password: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/csrf", () => ({ isSameOriginRequest: () => true }));
vi.mock("@/lib/surface", () => ({
  getRequestOrigin: () => "https://merchant.example",
  requireRequestSurface: () => true,
}));
vi.mock("@/lib/auth/password", () => ({ verifyPassword: mocks.password }));
vi.mock("@/lib/auth/session", () => ({
  createPortalSession: mocks.createSession,
  SESSION_COOKIE_OPTIONS: {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
  },
}));
vi.mock("@/lib/portal-store", () => ({
  getPortalStore: () => ({
    consumeApplicationReturnStateNonce: mocks.consumeNonce,
    findLocalBusiness: mocks.findLocalBusiness,
    findLoginMembership: mocks.findLoginMembership,
  }),
}));

import { createApplicationReturnState } from "@/lib/application-routing/return-state";
import { POST } from "@/app/api/auth/login/route";

function loginRequest(state: string, identifier: "email" | "username" = "email") {
  const body = new URLSearchParams({
    [identifier]: identifier === "email" ? "owner@example.com" : "MerchantOwner",
    password: "password",
    state,
  });
  return new Request("https://merchant.example/api/auth/login", {
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "https://merchant.example",
    },
    method: "POST",
  });
}

describe("merchant login application return state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv(
      "APPLICATION_RETURN_STATE_SECRET",
      Buffer.alloc(32, 23).toString("base64"),
    );
    mocks.findLocalBusiness.mockResolvedValue({ id: "business-1" });
    mocks.findLoginMembership.mockResolvedValue({
      id: "membership-1",
      user: { passwordHash: "hash" },
    });
    mocks.password.mockResolvedValue(true);
    mocks.createSession.mockResolvedValue({
      token: "portal-session",
      expiresAt: new Date("2026-07-27T00:00:00.000Z"),
    });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns to the signed capability path after consuming its nonce", async () => {
    mocks.consumeNonce.mockResolvedValue(true);
    const state = createApplicationReturnState("/apps/events");
    const response = await POST(loginRequest(state));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://merchant.example/apps/events",
    );
    expect(mocks.consumeNonce).toHaveBeenCalledOnce();
  });

  it("does not replay an already-consumed return state", async () => {
    mocks.consumeNonce.mockResolvedValue(false);
    const state = createApplicationReturnState("/apps/events");
    const response = await POST(loginRequest(state));

    expect(response.headers.get("location")).toBe(
      "https://merchant.example/business",
    );
  });

  it("uses username exclusively after the business completes cutover", async () => {
    mocks.findLocalBusiness.mockResolvedValue({
      id: "business-1",
      usernameLoginEnabledAt: new Date(),
    });
    mocks.findLoginMembership.mockImplementation(async (identifier: string) =>
      identifier ? { id: "membership-1", user: { passwordHash: "hash" } } : null,
    );

    const usernameResponse = await POST(loginRequest("", "username"));
    expect(usernameResponse.headers.get("location")).toBe(
      "https://merchant.example/business",
    );
    expect(mocks.findLoginMembership).toHaveBeenLastCalledWith(
      "MerchantOwner",
      "business-1",
    );

    const emailResponse = await POST(loginRequest("", "email"));
    expect(emailResponse.headers.get("location")).toBe(
      "https://merchant.example/login?error=invalid",
    );
    expect(mocks.findLoginMembership).toHaveBeenLastCalledWith("", "business-1");
  });
});
