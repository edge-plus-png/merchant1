import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import { hashPassword } from "@/lib/auth/password";
import { hashSessionToken } from "@/lib/auth/session";
import { getPortalStore } from "@/lib/portal-store";
import { requireRequestSurface } from "@/lib/surface";

const acceptanceSchema = z
  .object({
    token: z.string().min(32).max(256),
    password: z.string().min(12).max(256),
    confirmPassword: z.string().min(12).max(256),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
  });

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(
    new URL(path, request.headers.get("origin") ?? request.url),
    { status: 303 },
  );
}

export async function POST(request: Request) {
  if (!requireRequestSurface(request, "MERCHANT")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (!isSameOriginRequest(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const formData = await request.formData();
  const parsed = acceptanceSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    const token = String(formData.get("token") ?? "");
    return redirectTo(
      request,
      `/invite/${encodeURIComponent(token)}?error=password`,
    );
  }

  const tokenHash = hashSessionToken(parsed.data.token);
  const store = getPortalStore();
  const invitation = await store.findInvitation(tokenHash);
  const result = await store.acceptInvitation({
    tokenHash,
    passwordHash: await hashPassword(parsed.data.password),
  });

  if (result !== "accepted") {
    return redirectTo(
      request,
      `/invite/${encodeURIComponent(parsed.data.token)}?error=invalid`,
    );
  }

  return redirectTo(
    request,
    invitation?.purpose === "PASSWORD_RESET"
      ? "/login?reset=accepted"
      : "/login?invited=accepted",
  );
}
