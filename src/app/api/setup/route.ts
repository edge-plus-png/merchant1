import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import { hashPassword } from "@/lib/auth/password";
import { getHQStore } from "@/lib/hq-store";
import { requireRequestSurface } from "@/lib/surface";

const setupSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  masterName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(12).max(256),
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

  const store = getHQStore();

  if (await store.isSetupComplete()) {
    return redirectTo(request, "/setup?error=exists");
  }

  try {
    const result = await store.createEdgeMaster({
      companyName: parsed.data.companyName,
      masterName: parsed.data.masterName,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
    });

    if (result.status === "already_setup") {
      return redirectTo(request, "/setup?error=exists");
    }

    return redirectTo(request, "/login?setup=complete");
  } catch {
    return redirectTo(request, "/setup?error=invalid");
  }
}
