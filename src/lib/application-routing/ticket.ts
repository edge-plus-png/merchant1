import { randomUUID, sign, verify } from "node:crypto";
import { z } from "zod";
import {
  getCapabilityLaunchKeyId,
  getCapabilityLaunchPrivateKey,
  getCapabilityLaunchTicketTtlSeconds,
} from "@/lib/env";
import type { CapabilityManifest } from "@/lib/application-routing/manifest";
import type {
  MerchantApplicationRecord,
  PortalContext,
} from "@/lib/portal-types";

const launchHeaderSchema = z.object({
  alg: z.literal("EdDSA"),
  typ: z.literal("GETEDGE-CAPABILITY+JWT"),
  kid: z.string().min(3).max(80),
});

const launchPayloadSchema = z.object({
  version: z.literal(1),
  issuer: z.literal("getedge-merchant-portal"),
  audience: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/),
  nonce: z.string().uuid(),
  portalOrigin: z.string().url(),
  applicationOrigin: z.string().url(),
  environment: z.enum(["staging", "production"]),
  initiatedBy: z.string().min(1),
  merchant: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
  }),
  entitlement: z.object({
    applicationId: z.string().min(1),
    slug: z.string().min(1),
    installedAt: z.string().datetime(),
  }),
  issuedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
});

export type CapabilityLaunchTicketPayload = z.infer<
  typeof launchPayloadSchema
>;

function encodeJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeJson(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
}

export function createCapabilityLaunchTicket(
  context: PortalContext,
  application: MerchantApplicationRecord,
  manifest: CapabilityManifest,
  portalOrigin: string,
  now = new Date(),
) {
  if (
    application.slug !== manifest.slug ||
    application.status !== "INSTALLED" ||
    !application.installedAt ||
    !application.launchUrl
  ) {
    throw new Error("Application is not installed for this merchant.");
  }

  if (context.kind === "HQ_SUPPORT") {
    throw new Error("Read-only HQ access cannot launch applications.");
  }

  const normalizedPortalOrigin = new URL(portalOrigin).origin;
  const applicationOrigin = new URL(manifest.applicationOrigin).origin;
  if (normalizedPortalOrigin === applicationOrigin) {
    throw new Error("Capability origin must be separate from Merchant Portal.");
  }

  const issuedAt = Math.floor(now.getTime() / 1000);
  const payload: CapabilityLaunchTicketPayload = {
    version: 1,
    issuer: "getedge-merchant-portal",
    audience: manifest.slug,
    nonce: randomUUID(),
    portalOrigin: normalizedPortalOrigin,
    applicationOrigin,
    environment: manifest.environment,
    initiatedBy:
      context.kind === "MERCHANT_USER"
        ? `merchant-user:${context.user.id}`
        : "edge-full-access",
    merchant: {
      id: context.business.id,
      name: context.business.name,
    },
    entitlement: {
      applicationId: application.id,
      slug: manifest.slug,
      installedAt: application.installedAt.toISOString(),
    },
    issuedAt,
    expiresAt: issuedAt + getCapabilityLaunchTicketTtlSeconds(),
  };
  const header = encodeJson({
    alg: "EdDSA",
    typ: "GETEDGE-CAPABILITY+JWT",
    kid: getCapabilityLaunchKeyId(),
  });
  const body = encodeJson(payload);
  const signingInput = `${header}.${body}`;
  const signature = sign(
    null,
    Buffer.from(signingInput),
    getCapabilityLaunchPrivateKey(),
  ).toString("base64url");

  return {
    token: `${signingInput}.${signature}`,
    payload,
  };
}

export function verifyCapabilityLaunchTicketSignature(
  token: string,
  publicKey: string,
  now = new Date(),
) {
  const [headerValue, payloadValue, signatureValue, extra] = token.split(".");
  if (!headerValue || !payloadValue || !signatureValue || extra) return null;

  try {
    launchHeaderSchema.parse(decodeJson(headerValue));
    const payload = launchPayloadSchema.parse(decodeJson(payloadValue));
    const signatureValid = verify(
      null,
      Buffer.from(`${headerValue}.${payloadValue}`),
      publicKey,
      Buffer.from(signatureValue, "base64url"),
    );
    const currentTime = Math.floor(now.getTime() / 1000);

    if (
      !signatureValid ||
      payload.entitlement.slug !== payload.audience ||
      payload.issuedAt > currentTime + 5 ||
      payload.expiresAt <= currentTime ||
      payload.expiresAt - payload.issuedAt > 60
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
