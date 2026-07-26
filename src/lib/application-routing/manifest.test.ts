import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCapabilityManifest } from "@/lib/application-routing/manifest";

vi.mock("server-only", () => ({}));

const application = {
  slug: "events",
  launchUrl: "https://events-staging.getedgeportal.app",
};
const manifest = {
  schemaVersion: 1,
  slug: "events",
  name: "Events",
  contractVersion: "1.0",
  applicationOrigin: "https://events-staging.getedgeportal.app",
  environment: "staging",
  launchUrl: "https://events-staging.getedgeportal.app/api/portal-launch",
  healthUrl: "https://events-staging.getedgeportal.app/api/health",
  portalLaunchKeyPath: "/.well-known/getedge-portal-launch-key",
  portalRouting: {
    version: 1,
    sessionCookie: { name: "events_session" },
    assetPrefix: "/_getedge/capability-assets/events",
  },
};

describe("capability manifest contract", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts the one schema shared by ticket and routing", () => {
    expect(parseCapabilityManifest(manifest, application)).toEqual(manifest);
  });

  it.each([
    { schemaVersion: 2 },
    { slug: "move" },
    { applicationOrigin: "https://attacker.example" },
    { launchUrl: "https://events-staging.getedgeportal.app/not-launch" },
    {
      launchUrl:
        "https://events-staging.getedgeportal.app/api/portal-launch#fragment",
    },
    { healthUrl: "https://attacker.example/api/health" },
    {
      healthUrl: "https://events-staging.getedgeportal.app/api/health#fragment",
    },
    { portalRouting: { ...manifest.portalRouting, version: 2 } },
    {
      portalRouting: {
        ...manifest.portalRouting,
        assetPrefix: "/_next",
      },
    },
  ])("rejects a mismatched schema or trust boundary: %o", (change) => {
    expect(() =>
      parseCapabilityManifest({ ...manifest, ...change }, application),
    ).toThrow("Capability manifest is invalid");
  });

  it("rejects Portal-owned cookie names declared by a capability", () => {
    vi.stubEnv("PORTAL_SESSION_COOKIE_NAME", "portal_session");
    expect(() =>
      parseCapabilityManifest(
        {
          ...manifest,
          portalRouting: {
            ...manifest.portalRouting,
            sessionCookie: { name: "portal_session" },
          },
        },
        application,
      ),
    ).toThrow("Capability manifest is invalid");
  });
});
