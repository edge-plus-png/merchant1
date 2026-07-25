import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageBusiness } from "@/lib/auth/authorization";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import { getPortalContext } from "@/lib/auth/session";
import { getPortalStore } from "@/lib/portal-store";
import { requireRequestSurface } from "@/lib/surface";

const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .transform((value) => value || null);

const businessSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    legalName: z.string().trim().min(2).max(200),
    supportEmail: z.string().trim().toLowerCase().email().max(254),
    contactName: z.string().trim().min(2).max(160),
    contactPhone: z.string().trim().min(7).max(40),
    addressLine1: z.string().trim().min(2).max(200),
    addressLine2: optionalText(200),
    city: z.string().trim().min(2).max(120),
    county: optionalText(120),
    postcode: z.string().trim().min(2).max(20),
    countryCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/),
    vatStatus: z.enum(["NOT_REGISTERED", "PENDING", "REGISTERED"]),
    vatNumber: optionalText(40),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en-GB", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/),
  })
  .superRefine((value, context) => {
    if (value.vatStatus === "REGISTERED" && !value.vatNumber) {
      context.addIssue({
        code: "custom",
        message: "VAT number is required for a VAT-registered business.",
        path: ["vatNumber"],
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
  if (!requireRequestSurface(request, "MERCHANT")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (!isSameOriginRequest(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const context = await getPortalContext();

  if (
    !context ||
    context.kind !== "MERCHANT_USER" ||
    !canManageBusiness(context.role)
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const parsed = businessSchema.safeParse(
    Object.fromEntries((await request.formData()).entries()),
  );

  if (!parsed.success) {
    return redirectTo(request, "/business?error=invalid");
  }

  const business = await getPortalStore().updateBusiness({
    businessId: context.business.id,
    ...parsed.data,
  });

  return redirectTo(
    request,
    business ? "/business?saved=1" : "/business?error=missing",
  );
}
