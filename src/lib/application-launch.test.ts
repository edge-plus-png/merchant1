import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  MerchantApplicationRecord,
  MerchantPortalContext,
  PortalContext,
} from "@/lib/portal-types";

const testPrivateKey = [
  "-----BEGIN PRIVATE KEY-----",
  "MC4CAQAwBQYDK2VwBCIEIGB5JbxemxHwpdQwBWOL+vaK3sl3gAb+kQAoRSww404N",
  "-----END PRIVATE KEY-----",
  "",
].join("\n");

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  listApplicationAccessSlugs: vi.fn(),
  listApplications: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
  getPortalContext: mocks.context,
}));
vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return {
    ...actual,
    getMoveApplicationOrigin: () => "https://merchant.example",
    getMoveLaunchKeyId: () => "portal-capability-test-1",
    getMoveLaunchPrivateKey: () => testPrivateKey,
    getMoveLaunchTicketTtlSeconds: () => 45,
  };
});
vi.mock("@/lib/portal-store", () => ({
  getPortalStore: () => ({
    listApplicationAccessSlugs: mocks.listApplicationAccessSlugs,
    listApplications: mocks.listApplications,
  }),
}));

import { launchPortalApplication } from "@/lib/application-launch";

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
  launchUrl: "https://merchant.example",
  installedAt: now,
  createdAt: now,
  updatedAt: now,
};
const directOptions = {
  unauthenticated: "login",
  unavailable: "apps",
} as const;

function directRequest(slug = "move") {
  return new Request(`https://merchant.example/apps/${slug}`, {
    headers: { host: "merchant.example" },
  });
}

describe("Portal application launcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.context.mockResolvedValue(context);
    mocks.listApplicationAccessSlugs.mockResolvedValue(["move"]);
    mocks.listApplications.mockResolvedValue([installedApplication]);
  });

  it("launches an installed application for an entitled Owner", async () => {
    const response = await launchPortalApplication(
      directRequest(),
      "move",
      directOptions,
    );
    const body = await response.text();
    const ticket = body.match(/name="ticket" value="([^"]+)"/)?.[1];

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("content-security-policy")).toContain(
      "form-action https://merchant.example",
    );
    expect(body).toContain(
      'action="https://merchant.example/apps/move/api/portal-launch" method="post"',
    );
    expect(body).toContain('<script defer src="/move-handover.js"></script>');
    expect(ticket).toBeTruthy();
    expect(body).not.toContain("?ticket=");
    expect(body).not.toContain("#ticket=");
  });

  it("redirects every unavailable state to the same /apps location", async () => {
    mocks.listApplications.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { ...installedApplication, status: "NOT_INSTALLED", installedAt: null },
    ]);

    const missing = await launchPortalApplication(
      directRequest(),
      "move",
      directOptions,
    );
    const notInstalled = await launchPortalApplication(
      directRequest(),
      "move",
      directOptions,
    );

    expect(missing.status).toBe(303);
    expect(missing.headers.get("location")).toBe("https://merchant.example/apps");
    expect(notInstalled.status).toBe(303);
    expect(notInstalled.headers.get("location")).toBe(
      "https://merchant.example/apps",
    );
  });

  it("keeps Owner launch access dependent on PortalCapabilityAccess", async () => {
    mocks.listApplicationAccessSlugs.mockResolvedValue([]);

    const response = await launchPortalApplication(
      directRequest(),
      "move",
      directOptions,
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://merchant.example/apps");
    expect(mocks.listApplications).not.toHaveBeenCalled();
  });

  it("allows Edge full access without creating a merchant membership grant", async () => {
    const edgeContext: PortalContext = {
      kind: "EDGE",
      sessionId: "edge-session-1",
      expiresAt: context.expiresAt,
      role: "EDGE",
      membershipId: null,
      user: {
        id: "edge-user-1",
        username: "edge.operator",
        name: "Edge Operator",
        status: "ACTIVE",
      },
      business: context.business,
      support: {
        hqId: "edge-hq",
        hqName: "Edge HQ",
        accessMode: "EDGE_FULL_ACCESS",
        ticketIssuedAt: now,
        auditIdentifier: "hqa-edge-1",
      },
    };
    mocks.context.mockResolvedValue(edgeContext);

    const response = await launchPortalApplication(
      directRequest(),
      "move",
      directOptions,
    );

    expect(response.status).toBe(200);
    expect(mocks.listApplicationAccessSlugs).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated requests to login", async () => {
    mocks.context.mockResolvedValue(null);

    const response = await launchPortalApplication(
      directRequest(),
      "move",
      directOptions,
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://merchant.example/login",
    );
  });

  it("keeps unsupported future slugs on the neutral apps fallback", async () => {
    mocks.listApplicationAccessSlugs.mockResolvedValue(["events"]);
    mocks.listApplications.mockResolvedValue([
      {
        ...installedApplication,
        id: "application-events",
        slug: "events",
      },
    ]);

    const response = await launchPortalApplication(
      directRequest("events"),
      "events",
      directOptions,
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://merchant.example/apps");
  });

  it("does not disclose an environment configuration mismatch", async () => {
    mocks.listApplications.mockResolvedValue([
      { ...installedApplication, launchUrl: "https://untrusted.example" },
    ]);

    const response = await launchPortalApplication(
      directRequest(),
      "move",
      directOptions,
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://merchant.example/apps");
  });
});
