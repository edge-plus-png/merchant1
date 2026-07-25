import { randomUUID, sign, verify } from "node:crypto";
import { z } from "zod";
import {
  getMoveApplicationEnvironment,
  getMoveLaunchKeyId,
  getMoveLaunchPrivateKey,
  getMoveLaunchTicketTtlSeconds,
  parseMoveApplicationOrigin,
} from "@/lib/env";
import type {
  MerchantApplicationRecord,
  PortalContext,
} from "@/lib/portal-types";

const moveLaunchHeaderSchema = z.object({
  alg: z.literal("EdDSA"),
  typ: z.literal("MOVE+JWT"),
  kid: z.string().min(3).max(80),
});

const moveLaunchPayloadSchema = z.object({
  version: z.literal(1),
  issuer: z.literal("getedge-merchant-portal"),
  audience: z.literal("move"),
  nonce: z.string().uuid(),
  portalOrigin: z.string().url(),
  moveOrigin: z.string().url(),
  environment: z.enum(["staging", "production"]),
  initiatedBy: z.string().min(1),
  merchant: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
  }),
  entitlement: z.object({
    applicationId: z.string().min(1),
    slug: z.literal("move"),
    installedAt: z.string().datetime(),
  }),
  issuedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
});

export type MoveLaunchTicketPayload = z.infer<
  typeof moveLaunchPayloadSchema
>;

function encodeJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeJson(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
}

export function createMoveLaunchTicket(
  context: PortalContext,
  application: MerchantApplicationRecord,
  portalOrigin: string,
  now = new Date(),
) {
  if (
    application.slug !== "move" ||
    application.status !== "INSTALLED" ||
    !application.installedAt ||
    !application.launchUrl
  ) {
    throw new Error("Move is not installed for this merchant.");
  }

  const normalizedPortalOrigin = new URL(portalOrigin).origin;
  const moveOrigin = parseMoveApplicationOrigin(application.launchUrl);

  if (context.kind === "HQ_SUPPORT") {
    throw new Error("Read-only HQ access cannot launch Move.");
  }

  if (normalizedPortalOrigin === moveOrigin) {
    throw new Error("Move must be hosted outside Merchant Portal.");
  }

  const issuedAt = Math.floor(now.getTime() / 1000);
  const payload: MoveLaunchTicketPayload = {
    version: 1,
    issuer: "getedge-merchant-portal",
    audience: "move",
    nonce: randomUUID(),
    portalOrigin: normalizedPortalOrigin,
    moveOrigin,
    environment: getMoveApplicationEnvironment(moveOrigin),
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
      slug: "move",
      installedAt: application.installedAt.toISOString(),
    },
    issuedAt,
    expiresAt: issuedAt + getMoveLaunchTicketTtlSeconds(),
  };
  const header = encodeJson({
    alg: "EdDSA",
    typ: "MOVE+JWT",
    kid: getMoveLaunchKeyId(),
  });
  const body = encodeJson(payload);
  const signingInput = `${header}.${body}`;
  const signature = sign(
    null,
    Buffer.from(signingInput),
    getMoveLaunchPrivateKey(),
  ).toString("base64url");

  return {
    token: `${signingInput}.${signature}`,
    payload,
  };
}

export function verifyMoveLaunchTicketSignature(
  token: string,
  publicKey: string,
  now = new Date(),
) {
  const [headerValue, payloadValue, signatureValue, extra] = token.split(".");

  if (!headerValue || !payloadValue || !signatureValue || extra) {
    return null;
  }

  try {
    moveLaunchHeaderSchema.parse(decodeJson(headerValue));
    const payload = moveLaunchPayloadSchema.parse(decodeJson(payloadValue));
    const signingInput = `${headerValue}.${payloadValue}`;
    const signatureValid = verify(
      null,
      Buffer.from(signingInput),
      publicKey,
      Buffer.from(signatureValue, "base64url"),
    );
    const currentTime = Math.floor(now.getTime() / 1000);

    if (
      !signatureValid ||
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
