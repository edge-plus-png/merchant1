import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "getedgeportal",
      checks: { application: "ok" },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
