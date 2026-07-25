import { createPublicKey } from "node:crypto";
import { NextResponse } from "next/server";
import { getMoveLaunchKeyId, getMoveLaunchPrivateKey } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  const publicKey = createPublicKey(getMoveLaunchPrivateKey())
    .export({ format: "pem", type: "spki" })
    .toString();

  return NextResponse.json(
    {
      algorithm: "Ed25519",
      keyId: getMoveLaunchKeyId(),
      publicKey,
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
