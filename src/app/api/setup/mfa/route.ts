import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import {
  decryptSetupPayload,
  encryptMfaSecret,
  HQ_AUTH_COOKIE_OPTIONS,
  HQ_SETUP_COOKIE_NAME,
  verifyTotpCode,
} from "@/lib/hq-auth/mfa";
import { getHQStore } from "@/lib/hq-store";
import { requireRequestSurface } from "@/lib/surface";

const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/) });

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(
    new URL(path, request.headers.get("origin") ?? request.url),
    { status: 303 },
  );
}

function readCookie(request: Request, name: string) {
  return (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export async function POST(request: Request) {
  if (!requireRequestSurface(request, "HQ")) {
    return new NextResponse("Not Found", { status: 404 });
  }
  if (!isSameOriginRequest(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const store = getHQStore();
  if (await store.isSetupComplete()) {
    return redirectTo(request, "/login");
  }

  const parsed = codeSchema.safeParse(
    Object.fromEntries((await request.formData()).entries()),
  );
  const setup = decryptSetupPayload(readCookie(request, HQ_SETUP_COOKIE_NAME));

  if (!setup) return redirectTo(request, "/setup?error=expired");
  if (!parsed.success || !verifyTotpCode(setup.mfaSecret, parsed.data.code)) {
    return redirectTo(request, "/setup/mfa?error=invalid");
  }

  const result = await store.createEdgeMaster({
    companyName: setup.companyName,
    masterName: setup.masterName,
    username: setup.username,
    passwordHash: setup.passwordHash,
    mfaSecretCiphertext: encryptMfaSecret(setup.mfaSecret),
    mfaEnabledAt: new Date(),
  });
  const response = redirectTo(
    request,
    result.status === "created" ? "/login?setup=complete" : "/login",
  );
  response.cookies.set(HQ_SETUP_COOKIE_NAME, "", {
    ...HQ_AUTH_COOKIE_OPTIONS,
    expires: new Date(0),
  });
  return response;
}
