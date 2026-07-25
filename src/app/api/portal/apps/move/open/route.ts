import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import { getPortalContext } from "@/lib/auth/session";
import { getMoveApplicationOrigin, parseMoveApplicationOrigin } from "@/lib/env";
import { createMoveLaunchTicket } from "@/lib/move-launch/ticket";
import { getPortalStore } from "@/lib/portal-store";
import { requireRequestSurface } from "@/lib/surface";

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
  if (!context || context.kind === "HQ_SUPPORT") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (context.kind === "MERCHANT_USER") {
    const accessSlugs = await getPortalStore().listApplicationAccessSlugs(
      context.business.id,
      context.membershipId,
    );
    if (!accessSlugs.includes("move")) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  const application = (await getPortalStore().listApplications(context.business.id))
    .find((item) => item.slug === "move");

  if (
    !application ||
    application.status !== "INSTALLED" ||
    !application.installedAt ||
    !application.launchUrl
  ) {
    return redirectTo(request, "/apps?error=move-launch");
  }

  try {
    const moveOrigin = parseMoveApplicationOrigin(application.launchUrl);
    if (moveOrigin !== getMoveApplicationOrigin()) {
      return redirectTo(request, "/apps?error=move-configuration");
    }

    const portalOrigin = new URL(request.headers.get("origin") ?? request.url).origin;
    const launch = createMoveLaunchTicket(
      context,
      application,
      portalOrigin,
    );
    const handoverUrl = new URL("/api/portal-launch", moveOrigin).toString();
    const scriptNonce = crypto.randomUUID().replaceAll("-", "");
    const body = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Opening Move</title>
  </head>
  <body>
    <main>
      <h1>Opening Move</h1>
      <p>Your secure handover is in progress.</p>
      <form id="move-handover" action="${handoverUrl}" method="post">
        <input type="hidden" name="ticket" value="${launch.token}">
        <button type="submit">Continue to Move</button>
      </form>
    </main>
    <script nonce="${scriptNonce}">document.getElementById("move-handover").submit();</script>
  </body>
</html>`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Security-Policy": `default-src 'none'; form-action ${moveOrigin}; script-src 'nonce-${scriptNonce}'; style-src 'none'; base-uri 'none'; frame-ancestors 'none'`,
        "Content-Type": "text/html; charset=utf-8",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return redirectTo(request, "/apps?error=move-launch");
  }
}
