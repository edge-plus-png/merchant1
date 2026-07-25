import assert from "node:assert/strict";
import test from "node:test";
import {
  HQ_ACCESS_NONCE_RETENTION_DAYS,
  runHQAccessCleanup,
} from "../lib/hq-cleanup.js";

test("deletes expired support sessions and old consumed nonces", async () => {
  const calls = [];
  const now = new Date("2026-07-25T12:00:00.000Z");
  const sqlFactory = (databaseUrl) => {
    assert.equal(databaseUrl, "postgres://merchant");
    return async (strings, ...values) => {
      calls.push({ strings, values });
      return [{
        expiredSupportSessionsDeleted: 2,
        oldConsumedNoncesDeleted: 3,
      }];
    };
  };

  const result = await runHQAccessCleanup({
    databaseUrl: "postgres://merchant",
    now,
    sqlFactory,
  });

  assert.deepEqual(result, {
    expiredSupportSessionsDeleted: 2,
    oldConsumedNoncesDeleted: 3,
    nonceRetentionDays: HQ_ACCESS_NONCE_RETENTION_DAYS,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].values[0], "2026-07-25T12:00:00.000Z");
  assert.equal(calls[0].values[1], "2026-06-25T12:00:00.000Z");
  assert.match(calls[0].strings.join("?"), /DELETE FROM "HQSupportSession"/);
  assert.match(calls[0].strings.join("?"), /DELETE FROM "HQAccessTicketNonce"/);
});

test("requires a database URL", async () => {
  await assert.rejects(
    runHQAccessCleanup(),
    /database URL is required/,
  );
});
