import { NextResponse } from "next/server";
import { getCapabilityLaunchPublicKey } from "@/lib/application-routing/ticket";
import { getCapabilityLaunchKeyId } from "@/lib/env";
import { requireRequestSurface } from "@/lib/surface";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!requireRequestSurface(request, "MERCHANT")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  return NextResponse.json(
    {
      algorithm: "Ed25519",
      keyId: getCapabilityLaunchKeyId(),
      publicKey: getCapabilityLaunchPublicKey(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
