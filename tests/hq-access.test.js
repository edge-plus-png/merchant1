import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { inspectHQAccessTicket, verifyHQAccessTicket } from "../lib/hq-access.js";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }).toString();

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function makeTicket(overrides = {}) {
  const now = Math.floor(Date.now() / 1_000);
  const header = encode({ alg: "EdDSA", typ: "HQA+JWT" });
  const payload = encode({
    version: 1,
    issuer: "getedge-hq",
    audience: "merchant-portal-hq-access",
    nonce: "9bb8c9ae-89eb-4d19-b795-0e32d96eb93d",
    auditIdentifier: "hqa_9bb8c9ae-89eb-4d19-b795-0e32d96eb93d",
    targetBusiness: {
      id: "merchant-1",
      name: "Merchant 1",
      portalOrigin: "https://merchant.getedgeportal.app",
    },
    originHq: { id: "hq-1", name: "Edge HQ" },
    operator: { id: "user-1", name: "HQ Operator", email: "operator@example.com" },
    accessMode: "SUPPORT_READ_ONLY",
    issuedAt: now,
    expiresAt: now + 45,
    ...overrides,
  });
  const signingInput = `${header}.${payload}`;
  const signature = sign(null, Buffer.from(signingInput), privateKey).toString("base64url");
  return `${signingInput}.${signature}`;
}

function makeUsernameTicket() {
  const now = Math.floor(Date.now() / 1_000);
  return makeTicket({
    operator: { id: "user-1", name: "HQ Operator", username: "edge" },
    issuedAt: now,
    expiresAt: now + 45,
  });
}

test("accepts a valid, origin-bound HQ access ticket", () => {
  const ticket = makeTicket();
  const payload = verifyHQAccessTicket(ticket, {
    portalOrigin: "https://merchant.getedgeportal.app",
    publicKey: publicKeyPem,
  });
  assert.equal(payload?.targetBusiness.id, "merchant-1");
});

test("accepts HQ tickets that identify the operator by username", () => {
  const payload = verifyHQAccessTicket(makeUsernameTicket(), {
    portalOrigin: "https://merchant.getedgeportal.app",
    publicKey: publicKeyPem,
  });
  assert.equal(payload?.operator.username, "edge");
});

test("rejects a ticket issued for a different merchant origin", () => {
  const ticket = makeTicket();
  const inspection = inspectHQAccessTicket(ticket, {
      portalOrigin: "https://other.getedgeportal.app",
      publicKey: publicKeyPem,
  });
  assert.equal(inspection.payload, null);
  assert.equal(inspection.reason, "origin_mismatch");
});

test("rejects an expired ticket", () => {
  const now = Math.floor(Date.now() / 1_000);
  const ticket = makeTicket({ issuedAt: now - 46, expiresAt: now - 1 });
  assert.equal(
    verifyHQAccessTicket(ticket, {
      portalOrigin: "https://merchant.getedgeportal.app",
      publicKey: publicKeyPem,
    }),
    null,
  );
});

test("rejects a ticket with a tampered payload", () => {
  const parts = makeTicket().split(".");
  parts[1] = encode({ nope: true });
  assert.equal(
    verifyHQAccessTicket(parts.join("."), {
      portalOrigin: "https://merchant.getedgeportal.app",
      publicKey: publicKeyPem,
    }),
    null,
  );
});
