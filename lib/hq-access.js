import { createPublicKey, verify } from "node:crypto";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function decodeJson(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function isNonEmptyString(value, maxLength = 512) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isValidPayload(payload) {
  return Boolean(
    payload &&
      payload.version === 1 &&
      payload.issuer === "getedge-hq" &&
      payload.audience === "merchant-portal-hq-access" &&
      isNonEmptyString(payload.nonce, 64) &&
      UUID_PATTERN.test(payload.nonce) &&
      isNonEmptyString(payload.auditIdentifier, 128) &&
      payload.auditIdentifier.length >= 8 &&
      payload.targetBusiness &&
      isNonEmptyString(payload.targetBusiness.id, 128) &&
      isNonEmptyString(payload.targetBusiness.name) &&
      isNonEmptyString(payload.targetBusiness.portalOrigin, 2_048) &&
      payload.originHq &&
      isNonEmptyString(payload.originHq.id, 128) &&
      isNonEmptyString(payload.originHq.name) &&
      payload.operator &&
      isNonEmptyString(payload.operator.id, 128) &&
      isNonEmptyString(payload.operator.name) &&
      ((isNonEmptyString(payload.operator.email, 320) &&
        payload.operator.email.includes("@")) ||
        isNonEmptyString(payload.operator.username, 320)) &&
      payload.accessMode === "SUPPORT_READ_ONLY" &&
      Number.isInteger(payload.issuedAt) &&
      payload.issuedAt > 0 &&
      Number.isInteger(payload.expiresAt) &&
      payload.expiresAt > 0
  );
}

function payloadShape(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { payloadType: Array.isArray(payload) ? "array" : typeof payload };
  }

  return {
    payloadKeys: Object.keys(payload).sort(),
    version: payload.version,
    issuer: payload.issuer,
    audience: payload.audience,
    accessMode: payload.accessMode,
    nonceType: typeof payload.nonce,
    auditIdentifierType: typeof payload.auditIdentifier,
    issuedAtType: typeof payload.issuedAt,
    expiresAtType: typeof payload.expiresAt,
    targetBusinessKeys:
      payload.targetBusiness && typeof payload.targetBusiness === "object"
        ? Object.keys(payload.targetBusiness).sort()
        : [],
    originHqKeys:
      payload.originHq && typeof payload.originHq === "object"
        ? Object.keys(payload.originHq).sort()
        : [],
    operatorKeys:
      payload.operator && typeof payload.operator === "object"
        ? Object.keys(payload.operator).sort()
        : [],
  };
}

function normalizePublicKey(value) {
  return value.trim().replace(/\\n/g, "\n");
}

export function inspectHQAccessTicket(token, { portalOrigin, publicKey, now = new Date() }) {
  if (typeof token !== "string" || token.length < 64 || token.length > 16_384) {
    return { payload: null, reason: "invalid_format" };
  }

  const [headerValue, payloadValue, signatureValue, extra] = token.split(".");
  if (!headerValue || !payloadValue || !signatureValue || extra) {
    return { payload: null, reason: "invalid_format" };
  }

  try {
    const header = decodeJson(headerValue);
    const payload = decodeJson(payloadValue);
    if (header?.alg !== "EdDSA" || header?.typ !== "HQA+JWT") {
      return { payload: null, reason: "invalid_header" };
    }
    if (!isValidPayload(payload)) {
      return {
        payload: null,
        reason: "invalid_payload",
        diagnostic: payloadShape(payload),
      };
    }

    const expectedOrigin = new URL(portalOrigin).origin;
    const targetOrigin = new URL(payload.targetBusiness.portalOrigin).origin;
    if (targetOrigin !== expectedOrigin) {
      return {
        payload: null,
        reason: "origin_mismatch",
        diagnostic: { expectedOrigin, targetOrigin },
      };
    }

    const signingInput = `${headerValue}.${payloadValue}`;
    const signatureValid = verify(
      null,
      Buffer.from(signingInput),
      createPublicKey(normalizePublicKey(publicKey)),
      Buffer.from(signatureValue, "base64url"),
    );
    const currentTime = Math.floor(now.getTime() / 1_000);

    if (!signatureValid) {
      return { payload: null, reason: "signature_mismatch" };
    }
    if (payload.issuedAt > currentTime + 5) {
      return { payload: null, reason: "issued_in_future" };
    }
    if (payload.expiresAt <= currentTime) {
      return { payload: null, reason: "expired" };
    }
    if (
      payload.expiresAt <= payload.issuedAt ||
      payload.expiresAt - payload.issuedAt > 120
    ) {
      return { payload: null, reason: "invalid_lifetime" };
    }

    return { payload, reason: null };
  } catch {
    return { payload: null, reason: "verification_error" };
  }
}

export function verifyHQAccessTicket(token, options) {
  return inspectHQAccessTicket(token, options).payload;
}
