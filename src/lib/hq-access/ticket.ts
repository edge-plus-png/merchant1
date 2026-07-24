import { randomUUID, sign, verify } from "node:crypto";
import { z } from "zod";
import {
  getHQAccessPrivateKey,
  getHQAccessPublicKey,
  getHQAccessTicketTtlSeconds,
} from "@/lib/env";
import type {
  BusinessRecord,
  HQAccessMode,
  HQContext,
} from "@/lib/portal-types";

const ticketHeaderSchema = z.object({
  alg: z.literal("EdDSA"),
  typ: z.literal("HQA+JWT"),
});

const ticketPayloadSchema = z.object({
  version: z.literal(1),
  issuer: z.literal("getedge-hq"),
  audience: z.literal("merchant-portal-hq-access"),
  nonce: z.string().uuid(),
  auditIdentifier: z.string().min(8).max(128),
  targetBusiness: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    portalOrigin: z.string().url(),
  }),
  originHq: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
  }),
  operator: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email(),
  }),
  accessMode: z.literal("SUPPORT_READ_ONLY"),
  issuedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
});

export type HQAccessTicketPayload = z.infer<typeof ticketPayloadSchema>;

function encodeJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeJson(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
}

export function createHQAccessTicket(
  context: HQContext,
  business: BusinessRecord,
  now = new Date(),
) {
  if (!business.portalUrl) {
    throw new Error("The target business does not have a Portal URL.");
  }

  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAt = issuedAt + getHQAccessTicketTtlSeconds();
  const auditIdentifier = `hqa_${randomUUID()}`;
  const accessMode: HQAccessMode = "SUPPORT_READ_ONLY";
  const payload: HQAccessTicketPayload = {
    version: 1,
    issuer: "getedge-hq",
    audience: "merchant-portal-hq-access",
    nonce: randomUUID(),
    auditIdentifier,
    targetBusiness: {
      id: business.id,
      name: business.name,
      portalOrigin: new URL(business.portalUrl).origin,
    },
    originHq: {
      id: context.hq.id,
      name: context.hq.name,
    },
    operator: {
      id: context.user.id,
      name: context.user.name,
      email: context.user.email,
    },
    accessMode,
    issuedAt,
    expiresAt,
  };
  const header = encodeJson({ alg: "EdDSA", typ: "HQA+JWT" });
  const body = encodeJson(payload);
  const signingInput = `${header}.${body}`;
  const signature = sign(
    null,
    Buffer.from(signingInput),
    getHQAccessPrivateKey(),
  ).toString("base64url");

  return {
    token: `${signingInput}.${signature}`,
    payload,
  };
}

export function verifyHQAccessTicket(
  token: string,
  expected: { businessId: string; portalOrigin: string },
  now = new Date(),
): HQAccessTicketPayload | null {
  const [headerValue, payloadValue, signatureValue, extra] = token.split(".");

  if (!headerValue || !payloadValue || !signatureValue || extra) {
    console.warn("HQ access ticket rejected", { reason: "malformed" });
    return null;
  }

  try {
    ticketHeaderSchema.parse(decodeJson(headerValue));
    const payload = ticketPayloadSchema.parse(decodeJson(payloadValue));
    const signingInput = `${headerValue}.${payloadValue}`;
    const signatureValid = verify(
      null,
      Buffer.from(signingInput),
      getHQAccessPublicKey(),
      Buffer.from(signatureValue, "base64url"),
    );
    const currentTime = Math.floor(now.getTime() / 1000);
    const expectedOrigin = new URL(expected.portalOrigin).origin;
    const checks = {
      signatureValid,
      businessMatches: payload.targetBusiness.id === expected.businessId,
      originMatches: payload.targetBusiness.portalOrigin === expectedOrigin,
      issuedAtValid: payload.issuedAt <= currentTime + 5,
      notExpired: payload.expiresAt > currentTime,
      lifetimeValid: payload.expiresAt - payload.issuedAt <= 120,
    };

    if (
      !checks.signatureValid ||
      !checks.businessMatches ||
      !checks.originMatches ||
      !checks.issuedAtValid ||
      !checks.notExpired ||
      !checks.lifetimeValid
    ) {
      console.warn("HQ access ticket rejected", checks);
      return null;
    }

    return payload;
  } catch (error) {
    console.warn("HQ access ticket rejected", {
      reason: "exception",
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return null;
  }
}
