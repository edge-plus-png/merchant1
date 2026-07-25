import { runHQAccessCleanup } from "../../lib/hq-cleanup.js";

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { ok: false, error: "Method Not Allowed" });
  }

  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    request.headers.authorization !== `Bearer ${secret}`
  ) {
    return sendJson(response, 401, { ok: false, error: "Unauthorized." });
  }

  const databaseUrl =
    process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
  if (!databaseUrl) {
    return sendJson(response, 503, {
      ok: false,
      error: "Merchant database is not configured.",
    });
  }

  try {
    const result = await runHQAccessCleanup({ databaseUrl });
    console.info(JSON.stringify({ event: "hq_access_cleanup_completed", ...result }));
    return sendJson(response, 200, { ok: true, ...result });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "hq_access_cleanup_failed",
        errorType: error instanceof Error ? error.name : "UnknownError",
      }),
    );
    return sendJson(response, 500, { ok: false, error: "Cleanup failed." });
  }
}
