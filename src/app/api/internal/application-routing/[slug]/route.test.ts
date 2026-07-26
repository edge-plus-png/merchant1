import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  business: vi.fn(),
  listApplications: vi.fn(),
  manifest: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/application-routing/manifest", () => ({
  fetchCapabilityManifest: mocks.manifest,
}));
vi.mock("@/lib/portal-store", () => ({
  getPortalStore: () => ({
    findLocalBusiness: mocks.business,
    listApplications: mocks.listApplications,
  }),
}));
vi.mock("@/lib/surface", () => ({
  getRequestOrigin: () => "https://merchant.example",
  requireRequestSurface: () => true,
}));

import { GET } from "@/app/api/internal/application-routing/[slug]/route";

const application = {
  id: "application-events",
  businessId: "business-1",
  slug: "events",
  name: "Events",
  summary: "Events fixture",
  status: "INSTALLED",
  launchUrl: "https://events.example",
  installedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};
const manifest = {
  schemaVersion: 1,
  slug: "events",
  name: "Events",
  contractVersion: "1.0",
  applicationOrigin: "https://events.example",
  environment: "staging",
  launchUrl: "https://events.example/api/portal-launch",
  healthUrl: "https://events.example/api/health",
  portalLaunchKeyPath: "/.well-known/getedge-portal-launch-key",
  portalRouting: {
    version: 1,
    sessionCookie: { name: "events_session" },
    assetPrefix: "/_getedge/capability-assets/events",
  },
};

function request(secret = "test-shared-secret-with-at-least-32-characters") {
  return new Request(
    "https://merchant.example/api/internal/application-routing/events",
    { headers: { Authorization: `Bearer ${secret}` } },
  );
}

describe("gateway application registry endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv(
      "APPLICATION_GATEWAY_SHARED_SECRET",
      "test-shared-secret-with-at-least-32-characters",
    );
    mocks.business.mockResolvedValue({ id: "business-1" });
    mocks.listApplications.mockResolvedValue([application]);
    mocks.manifest.mockResolvedValue(manifest);
  });

  it("returns only validated routing data to the gateway", async () => {
    const response = await GET(request(), {
      params: Promise.resolve({ slug: "events" }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      available: true,
      slug: "events",
      applicationOrigin: "https://events.example",
      environment: "staging",
      launchUrl: "https://events.example/api/portal-launch",
      portalRouting: manifest.portalRouting,
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("uses the same unavailable response for bad auth and missing registration", async () => {
    const unauthorized = await GET(request("wrong-secret-that-is-at-least-32-bytes"), {
      params: Promise.resolve({ slug: "events" }),
    });
    mocks.listApplications.mockResolvedValue([]);
    const missing = await GET(request(), {
      params: Promise.resolve({ slug: "events" }),
    });
    expect(unauthorized.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await unauthorized.text()).toBe(await missing.text());
  });
});
