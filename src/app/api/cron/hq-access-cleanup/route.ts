import { NextResponse } from "next/server";
import { runHQAccessCleanup } from "@/lib/hq-access/cleanup";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return (
    Boolean(secret) &&
    request.headers.get("authorization") === `Bearer ${secret}`
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const result = await runHQAccessCleanup();
    console.info(
      JSON.stringify({
        event: "hq_access_cleanup_completed",
        ...result,
      }),
    );

    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "hq_access_cleanup_failed",
        errorType: error instanceof Error ? error.name : "UnknownError",
      }),
    );

    return NextResponse.json(
      { ok: false, error: "Cleanup failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
