import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import { hashPassword } from "@/lib/auth/password";
import {
  encryptSetupPayload,
  generateMfaSecret,
  HQ_AUTH_COOKIE_OPTIONS,
  HQ_SETUP_COOKIE_NAME,
  normalizeHQUsername,
} from "@/lib/hq-auth/mfa";
import { getHQStore } from "@/lib/hq-store";
import { requireRequestSurface } from "@/lib/surface";

const setupSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  masterName: z.string().trim().min(2).max(120),
  username: z
    .string()
    .transform(normalizeHQUsername)
    .pipe(z.string().min(3).max(64).regex(/^[a-z0-9._-]+$/)),
  password: z.string().min(12).max(256),
  passwordConfirm: z.string().min(12).max(256),
});

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(
    new URL(path, request.headers.get("origin") ?? request.url),
    { status: 303 },
  );
}

export async function POST(request: Request) {
  if (!requireRequestSurface(request, "HQ")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (!isSameOriginRequest(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const parsed = setupSchema.safeParse(
    Object.fromEntries((await request.formData()).entries()),
  );

  if (!parsed.success) {
    return redirectTo(request, "/setup?error=invalid");
  }

  if (parsed.data.password !== parsed.data.passwordConfirm) {
    return redirectTo(request, "/setup?error=password_mismatch");
  }

  const store = getHQStore();

  if (await store.isSetupComplete()) {
    return redirectTo(request, "/setup?error=exists");
  }

  try {
    const response = redirectTo(request, "/setup/mfa");
    response.cookies.set(
      HQ_SETUP_COOKIE_NAME,
      encryptSetupPayload({
        version: 1,
        companyName: parsed.data.companyName,
        masterName: parsed.data.masterName,
        username: parsed.data.username,
        passwordHash: await hashPassword(parsed.data.password),
        mfaSecret: generateMfaSecret(),
        expiresAt: Date.now() + 15 * 60 * 1000,
      }),
      { ...HQ_AUTH_COOKIE_OPTIONS, maxAge: 15 * 60 },
    );
    return response;
  } catch {
    return redirectTo(request, "/setup?error=invalid");
  }
}
