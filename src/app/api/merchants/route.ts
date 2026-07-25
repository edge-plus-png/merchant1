import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import { requireHQContext } from "@/lib/hq-auth/session";
import { getHQStore } from "@/lib/hq-store";
import { requireRequestSurface } from "@/lib/surface";

function isHttpUrl(value: string) {
  if (!value) return true;

  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const merchantSchema = z
  .object({
    businessName: z.string().trim().min(2).max(160),
    businessSlug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    portalUrl: z.string().trim().max(2048).refine(isHttpUrl),
    status: z.enum(["PROVISIONING", "READY"]),
  })
  .superRefine((value, context) => {
    if (value.status === "READY" && !value.portalUrl) {
      context.addIssue({
        code: "custom",
        message: "A ready merchant requires a Portal URL.",
        path: ["portalUrl"],
      });
    }
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

  const context = await requireHQContext();

  if (context.hq.type !== "EDGE" || context.role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const parsed = merchantSchema.safeParse(
    Object.fromEntries((await request.formData()).entries()),
  );

  if (!parsed.success) {
    return redirectTo(request, "/merchants/new?error=invalid");
  }

  try {
    await getHQStore().createMerchant({
      name: parsed.data.businessName,
      slug: parsed.data.businessSlug,
      portalUrl: parsed.data.portalUrl
        ? new URL(parsed.data.portalUrl).origin
        : null,
      status: parsed.data.status,
    });
  } catch {
    return redirectTo(request, "/merchants/new?error=duplicate");
  }

  return redirectTo(
    request,
    `/merchants?created=${encodeURIComponent(parsed.data.businessSlug)}`,
  );
}
