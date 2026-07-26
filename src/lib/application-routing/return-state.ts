import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  getApplicationReturnStateSecret,
  getApplicationReturnStateTtlSeconds,
} from "@/lib/env";

const returnPathSchema = z
  .string()
  .regex(/^\/apps\/[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/);
const payloadSchema = z.object({
  returnPath: returnPathSchema,
  issuedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  nonce: z.string().uuid(),
});

export type ApplicationReturnStatePayload = z.infer<typeof payloadSchema>;

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signature(value: string) {
  return createHmac("sha256", getApplicationReturnStateSecret())
    .update(value)
    .digest();
}

export function createApplicationReturnState(
  returnPath: string,
  now = new Date(),
) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const payload = payloadSchema.parse({
    returnPath,
    issuedAt,
    expiresAt: issuedAt + getApplicationReturnStateTtlSeconds(),
    nonce: randomUUID(),
  });
  const encoded = encode(payload);
  return `${encoded}.${signature(encoded).toString("base64url")}`;
}

export function verifyApplicationReturnState(
  state: string,
  now = new Date(),
): ApplicationReturnStatePayload | null {
  const [payloadValue, signatureValue, extra] = state.split(".");
  if (!payloadValue || !signatureValue || extra || state.length > 2048) {
    return null;
  }

  try {
    const suppliedSignature = Buffer.from(signatureValue, "base64url");
    const expectedSignature = signature(payloadValue);
    if (
      suppliedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(suppliedSignature, expectedSignature)
    ) {
      return null;
    }

    const payload = payloadSchema.parse(
      JSON.parse(Buffer.from(payloadValue, "base64url").toString("utf8")),
    );
    const currentTime = Math.floor(now.getTime() / 1000);
    if (
      payload.issuedAt > currentTime + 5 ||
      payload.expiresAt <= currentTime ||
      payload.expiresAt - payload.issuedAt >
        getApplicationReturnStateTtlSeconds()
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
