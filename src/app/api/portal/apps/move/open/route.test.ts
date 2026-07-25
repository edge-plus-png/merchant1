import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  MerchantApplicationRecord,
  MerchantPortalContext,
} from "@/lib/portal-types";

const testPrivateKey = [
  "-----BEGIN PRIVATE KEY-----",
  "MC4CAQAwBQYDK2VwBCIEIGB5JbxemxHwpdQwBWOL+vaK3sl3gAb+kQAoRSww404N",
  "-----END PRIVATE KEY-----",
  "",
].join("\n");

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  listApplications: vi.fn(),
  sameOrigin: vi.fn(),
}));

vi.mock("@/lib/auth/csrf", () => ({
  isSameOriginRequest: mocks.sameOrigin,
}));
vi.mock("@/lib/auth/session", () => ({
  getPortalContext: mocks.context,
}));
vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return {
    ...actual,
    getMoveApplicationOrigin: () => "https://capability.example",
    getMoveLaunchKeyId: () => "portal-capability-test-1",
    getMoveLaunchPrivateKey: () => testPrivateKey,
    getMoveLaunchTicketTtlSeconds: () => 45,
  };
});
vi.mock("@/lib/portal-store", () => ({
  getPortalStore: () => ({ listApplications: mocks.listApplications }),
}));
vi.mock("@/lib/surface", () => ({
  requireRequestSurface: () => true,
}));

import { POST } from "@/app/api/portal/apps/move/open/route";

const now = new Date("2026-07-24T12:00:00.000Z");
const context: MerchantPortalContext = {
  kind: "MERCHANT_USER",
  sessionId: "portal-session-1",
  expiresAt: new Date("2026-07-24T18:00:00.000Z"),
  membershipId: "membership-1",
  role: "OWNER",
  user: {
    id: "user-1",
    email: "owner@example.com",
    name: "Merchant Owner",
    status: "ACTIVE",
  },
  business: {
    id: "business-1",
    slug: "merchant-one",
    name: "Merchant One",
    legalName: null,
    supportEmail: null,
    contactName: null,
    contactPhone: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    county: null,
    postcode: null,
    countryCode: "GB",
    vatStatus: "NOT_REGISTERED",
    vatNumber: null,
    portalUrl: "https://merchant.example",
    status: "READY",
    timezone: "Europe/London",
    currency: "GBP",
    createdAt: now,
    updatedAt: now,
  },
};
const installedApplication: MerchantApplicationRecord = {
  id: "application-1",
  businessId: context.business.id,
  slug: "move",
  name: "Move",
  summary: "Merchant capability",
  status: "INSTALLED",
  launchUrl: "https://capability.example",
  installedAt: now,
  createdAt: now,
  updatedAt: now,
};

function openRequest() {
  return new Request("https://merchant.example/api/portal/apps/move/open", {
    method: "POST",
    headers: {
      host: "merchant.example",
      origin: "https://merchant.example",
    },
  });
}

describe("Portal capability handover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.context.mockResolvedValue(context);
    mocks.listApplications.mockResolvedValue([installedApplication]);
    mocks.sameOrigin.mockReturnValue(true);
  });

  it("refuses Open when the merchant does not have an installed entitlement", async () => {
    mocks.listApplications.mockResolvedValue([
      {
        ...installedApplication,
        status: "NOT_INSTALLED",
        installedAt: null,
      },
    ]);

    const response = await POST(openRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://merchant.example/apps?error=move-launch",
    );
  });

  it("rejects an application origin that differs from the configured environment", async () => {
    mocks.listApplications.mockResolvedValue([
      {
        ...installedApplication,
        launchUrl: "https://untrusted.example",
      },
    ]);

    const response = await POST(openRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://merchant.example/apps?error=move-configuration",
    );
  });

  it("delivers the ticket only in a POST body to the fixed trusted endpoint", async () => {
    const response = await POST(openRequest());
    const body = await response.text();
    const ticket = body.match(/name="ticket" value="([^"]+)"/)?.[1];

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("content-security-policy")).toContain(
      "form-action https://capability.example",
    );
    expect(body).toContain(
      'action="https://capability.example/api/portal-launch" method="post"',
    );
    expect(ticket).toBeTruthy();
    expect(body).not.toContain("?ticket=");
    expect(body).not.toContain("#ticket=");
    expect(new URL("https://capability.example/api/portal-launch").search).toBe("");
  });

  it("rejects cross-origin Open requests before issuing a ticket", async () => {
    mocks.sameOrigin.mockReturnValue(false);

    const response = await POST(openRequest());

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Forbidden");
    expect(mocks.listApplications).not.toHaveBeenCalled();
  });
});
