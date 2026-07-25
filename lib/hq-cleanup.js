import { neon } from "@neondatabase/serverless";

export const HQ_ACCESS_NONCE_RETENTION_DAYS = 30;

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1_000;

export async function runHQAccessCleanup({
  databaseUrl,
  now = new Date(),
  sqlFactory = neon,
} = {}) {
  if (!databaseUrl) {
    throw new Error("A database URL is required for HQ access cleanup.");
  }

  const nonceConsumedBefore = new Date(
    now.getTime() - HQ_ACCESS_NONCE_RETENTION_DAYS * DAY_IN_MILLISECONDS,
  );
  const sql = sqlFactory(databaseUrl);
  const [result] = await sql`
    WITH expired_support_sessions AS (
      DELETE FROM "HQSupportSession"
      WHERE "expiresAt" <= ${now.toISOString()}::timestamptz
      RETURNING 1
    ), old_consumed_nonces AS (
      DELETE FROM "HQAccessTicketNonce"
      WHERE "consumedAt" < ${nonceConsumedBefore.toISOString()}::timestamptz
      RETURNING 1
    )
    SELECT
      (SELECT count(*)::int FROM expired_support_sessions)
        AS "expiredSupportSessionsDeleted",
      (SELECT count(*)::int FROM old_consumed_nonces)
        AS "oldConsumedNoncesDeleted"
  `;

  return {
    expiredSupportSessionsDeleted: Number(
      result?.expiredSupportSessionsDeleted ?? 0,
    ),
    oldConsumedNoncesDeleted: Number(result?.oldConsumedNoncesDeleted ?? 0),
    nonceRetentionDays: HQ_ACCESS_NONCE_RETENTION_DAYS,
  };
}
