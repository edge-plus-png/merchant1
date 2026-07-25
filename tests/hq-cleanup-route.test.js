import assert from "node:assert/strict";
import test from "node:test";
import handler from "../api/cron/hq-access-cleanup.js";

function responseRecorder() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body) {
      this.body = body;
    },
  };
}

test("cron route rejects requests without the configured bearer secret", async () => {
  const previousSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "cron-test-secret";
  const response = responseRecorder();

  try {
    await handler({ method: "GET", headers: {} }, response);
  } finally {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  }

  assert.equal(response.statusCode, 401);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.deepEqual(JSON.parse(response.body), {
    ok: false,
    error: "Unauthorized.",
  });
});

test("cron route only accepts GET", async () => {
  const response = responseRecorder();
  await handler({ method: "POST", headers: {} }, response);

  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.allow, "GET");
});
