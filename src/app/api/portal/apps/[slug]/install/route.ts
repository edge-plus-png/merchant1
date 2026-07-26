import { NextResponse } from "next/server";
import { fetchCapabilityManifest } from "@/lib/application-routing/manifest";
import { canInstallApplication } from "@/lib/auth/authorization";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import { getPortalContext } from "@/lib/auth/session";
import { getPortalStore } from "@/lib/portal-store";
import { requireRequestSurface } from "@/lib/surface";

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(
    new URL(path, request.headers.get("origin") ?? request.url),
    { status: 303 },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!requireRequestSurface(request, "MERCHANT")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (!isSameOriginRequest(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const context = await getPortalContext();
  if (!context || !canInstallApplication(context.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { slug } = await params;
  const store = getPortalStore();
  const application = (await store.listApplications(context.business.id)).find(
    (item) => item.slug === slug,
  );
  if (!application?.launchUrl) {
    return redirectTo(request, "/apps?error=application-missing");
  }

  try {
    await fetchCapabilityManifest(application);
  } catch {
    return redirectTo(request, "/apps?error=application-configuration");
  }

  const result = await store.installApplication(
    context.business.id,
    slug,
    application.launchUrl,
  );
  return redirectTo(
    request,
    result.status === "not_found"
      ? "/apps?error=application-missing"
      : `/apps?installed=${encodeURIComponent(slug)}`,
  );
}
