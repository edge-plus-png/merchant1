import { createHash, randomBytes, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { inspectHQAccessTicket } from "../../lib/hq-access.js";

const COOKIE_NAME = "getedge_hq_support_session";
const SESSION_TTL_MINUTES = 30;

function firstHeader(value) {
  return Array.isArray(value) ? value[0] : value?.split(",")[0]?.trim();
}

function getRequestOrigin(request) {
  const protocol = firstHeader(request.headers["x-forwarded-proto"]) || "https";
  const host = firstHeader(request.headers["x-forwarded-host"]) || firstHeader(request.headers.host);
  return new URL(`${protocol}://${host}`).origin;
}

async function getTicket(request) {
  if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) {
    return request.body.ticket;
  }

  let body = typeof request.body === "string" ? request.body : "";
  if (!body && request.readable) {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(Buffer.from(chunk));
    }
    body = Buffer.concat(chunks).toString("utf8");
  }

  return new URLSearchParams(body).get("ticket");
}

function sendText(response, status, message) {
  response.statusCode = status;
  response.setHeader("Content-Type", "text/plain; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(message);
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendText(response, 405, "Method Not Allowed");
  }

  const publicKey = process.env.HQ_ACCESS_PUBLIC_KEY?.trim();
  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
  if (!publicKey || !databaseUrl) {
    return sendText(response, 503, "Merchant Portal HQ access is not configured.");
  }

  let portalOrigin;
  try {
    portalOrigin = getRequestOrigin(request);
    const canonicalUrl = process.env.PORTAL_CANONICAL_URL?.trim();
    if (canonicalUrl && new URL(canonicalUrl).origin !== portalOrigin) {
      return sendText(response, 404, "Not Found");
    }
  } catch {
    return sendText(response, 400, "Invalid request origin.");
  }

  const ticket = await getTicket(request);
  const inspection = inspectHQAccessTicket(ticket, { portalOrigin, publicKey });
  const payload = inspection.payload;
  if (!payload) {
    console.warn("HQ access ticket rejected", {
      reason: inspection.reason,
      portalOrigin,
      ...inspection.diagnostic,
    });
    return sendText(response, 401, "HQ access ticket is invalid or expired.");
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("base64url");
  const sessionId = randomUUID();
  const auditEventId = randomUUID();
  const operatorUsername = payload.operator.username ?? payload.operator.email;
  const operatorEmail = payload.operator.email ?? null;
  const sessionExpiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1_000).toISOString();
  const sql = neon(databaseUrl);

  try {
    const [result] = await sql`
      WITH local_business AS (
        SELECT id
        FROM "Business"
        WHERE id = ${payload.targetBusiness.id}
          AND lower(rtrim(coalesce("portalUrl", ''), '/')) = lower(${portalOrigin})
        LIMIT 1
      ), consumed_ticket AS (
        INSERT INTO "HQAccessTicketNonce" (
          nonce, "businessId", "auditIdentifier", "expiresAt", "consumedAt"
        )
        SELECT
          ${payload.nonce}, id, ${payload.auditIdentifier},
          to_timestamp(${payload.expiresAt}), now()
        FROM local_business
        ON CONFLICT (nonce) DO NOTHING
        RETURNING nonce, "businessId"
      ), support_session AS (
        INSERT INTO "HQSupportSession" (
          id, "tokenHash", "businessId", "originHqId", "originHqName",
          "hqUserId", "operatorName", "operatorUsername", "operatorEmail", "accessMode",
          "ticketIssuedAt", "expiresAt", "auditIdentifier", "createdAt", "lastSeenAt"
        )
        SELECT
          ${sessionId}, ${tokenHash}, "businessId", ${payload.originHq.id},
          ${payload.originHq.name}, ${payload.operator.id}, ${payload.operator.name},
          ${operatorUsername}, ${operatorEmail}, ${payload.accessMode}::"HQAccessMode",
          to_timestamp(${payload.issuedAt}), ${sessionExpiresAt}::timestamptz,
          ${payload.auditIdentifier}, now(), now()
        FROM consumed_ticket
        RETURNING id
      ), audit_event AS (
        INSERT INTO "HQAccessAuditEvent" (
          id, "auditIdentifier", action, "businessId", "originHqId",
          "originHqName", "hqUserId", "operatorName", "operatorUsername", "operatorEmail",
          "accessMode", "ticketIssuedAt", "expiresAt", "createdAt"
        )
        SELECT
          ${auditEventId}, ${payload.auditIdentifier},
          'SUPPORT_SESSION_CREATED'::"HQAccessAuditAction", "businessId",
          ${payload.originHq.id}, ${payload.originHq.name}, ${payload.operator.id},
          ${payload.operator.name}, ${operatorUsername}, ${operatorEmail},
          ${payload.accessMode}::"HQAccessMode", to_timestamp(${payload.issuedAt}),
          to_timestamp(${payload.expiresAt}), now()
        FROM consumed_ticket
        RETURNING id
      )
      SELECT
        EXISTS (SELECT 1 FROM local_business) AS "businessExists",
        EXISTS (SELECT 1 FROM consumed_ticket) AS "nonceConsumed",
        EXISTS (SELECT 1 FROM support_session) AS "sessionCreated",
        EXISTS (SELECT 1 FROM audit_event) AS "auditCreated"
    `;

    if (!result?.businessExists) {
      return sendText(response, 404, "Target merchant does not exist.");
    }
    if (!result.nonceConsumed) {
      return sendText(response, 409, "HQ access ticket has already been used.");
    }
    if (!result.sessionCreated || !result.auditCreated) {
      return sendText(response, 500, "HQ support session could not be created.");
    }
  } catch (error) {
    console.error("HQ support session exchange failed", error);
    return sendText(response, 500, "HQ support session could not be created.");
  }

  response.statusCode = 303;
  response.setHeader("Location", "/dashboard");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_TTL_MINUTES * 60}; HttpOnly; Secure; SameSite=Lax`,
  );
  response.end();
}
