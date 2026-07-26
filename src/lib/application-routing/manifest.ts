import "server-only";

import { z } from "zod";
import {
  getHQSessionCookieName,
  getHQSupportSessionCookieName,
  getSessionCookieName,
} from "@/lib/env";
import type { MerchantApplicationRecord } from "@/lib/portal-types";

const slugSchema = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/);
const cookieNameSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const httpsUrlSchema = z.string().url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    !url.hash
  );
});

export const capabilityManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    slug: slugSchema,
    name: z.string().trim().min(1).max(100),
    contractVersion: z.string().trim().min(1).max(32),
    applicationOrigin: httpsUrlSchema,
    environment: z.enum(["staging", "production"]),
    launchUrl: httpsUrlSchema,
    healthUrl: httpsUrlSchema,
    portalLaunchKeyPath: z.literal(
      "/.well-known/getedge-portal-launch-key",
    ),
    portalRouting: z
      .object({
        version: z.literal(1),
        sessionCookie: z
          .object({ name: cookieNameSchema })
          .strict(),
        assetPrefix: z.string(),
      })
      .strict(),
  })
  .strict();

export type CapabilityManifest = z.infer<typeof capabilityManifestSchema>;

export class CapabilityManifestError extends Error {
  constructor() {
    super("Capability manifest is invalid.");
    this.name = "CapabilityManifestError";
  }
}

function normalizeOrigin(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new CapabilityManifestError();
  }
  return url.origin;
}

function validateAssetPrefix(slug: string, value: string) {
  const expected = `/_getedge/capability-assets/${slug}`;
  if (
    value !== expected ||
    value.endsWith("/") ||
    value.includes("..") ||
    /%2f|%5c/i.test(value)
  ) {
    throw new CapabilityManifestError();
  }
}

export function parseCapabilityManifest(
  value: unknown,
  application: Pick<MerchantApplicationRecord, "slug" | "launchUrl">,
) {
  const parsed = capabilityManifestSchema.safeParse(value);
  if (!parsed.success || !application.launchUrl) {
    throw new CapabilityManifestError();
  }

  const manifest = parsed.data;
  const registeredOrigin = normalizeOrigin(application.launchUrl);
  const manifestOrigin = normalizeOrigin(manifest.applicationOrigin);
  const launchUrl = new URL(manifest.launchUrl);
  const healthUrl = new URL(manifest.healthUrl);
  const reservedCookieNames = new Set([
    getSessionCookieName(),
    getHQSessionCookieName(),
    getHQSupportSessionCookieName(),
  ]);

  if (
    manifest.slug !== application.slug ||
    manifestOrigin !== registeredOrigin ||
    launchUrl.origin !== registeredOrigin ||
    launchUrl.pathname !== "/api/portal-launch" ||
    launchUrl.search ||
    launchUrl.hash ||
    healthUrl.origin !== registeredOrigin ||
    healthUrl.pathname !== "/api/health" ||
    healthUrl.search ||
    healthUrl.hash ||
    reservedCookieNames.has(manifest.portalRouting.sessionCookie.name)
  ) {
    throw new CapabilityManifestError();
  }

  validateAssetPrefix(manifest.slug, manifest.portalRouting.assetPrefix);
  return manifest;
}

export async function fetchCapabilityManifest(
  application: Pick<MerchantApplicationRecord, "slug" | "launchUrl">,
  fetcher: typeof fetch = fetch,
) {
  if (!application.launchUrl) {
    throw new CapabilityManifestError();
  }

  const origin = normalizeOrigin(application.launchUrl);
  const response = await fetcher(
    new URL("/.well-known/getedge-capability.json", origin),
    {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    },
  );

  if (!response.ok) {
    throw new CapabilityManifestError();
  }

  return parseCapabilityManifest(await response.json(), application);
}
