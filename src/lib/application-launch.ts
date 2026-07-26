import "server-only";

import { NextResponse } from "next/server";
import { getPortalContext } from "@/lib/auth/session";
import { getMoveApplicationOrigin, parseMoveApplicationOrigin } from "@/lib/env";
import { createMoveLaunchTicket } from "@/lib/move-launch/ticket";
import { getPortalStore } from "@/lib/portal-store";
import { getRequestOrigin } from "@/lib/surface";

type FailureResponse = "apps" | "forbidden";

export type ApplicationLaunchOptions = {
  unauthenticated: "login" | "forbidden";
  unavailable: FailureResponse;
};

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, getRequestOrigin(request)), {
    status: 303,
  });
}

function forbidden() {
  return new NextResponse("Forbidden", { status: 403 });
}

function unavailableResponse(request: Request, response: FailureResponse) {
  return response === "apps" ? redirectTo(request, "/apps") : forbidden();
}

function moveHandoverResponse(
  request: Request,
  moveOrigin: string,
  ticket: string,
) {
  const handoverUrl = new URL("/api/portal-launch", moveOrigin).toString();
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
        <input type="hidden" name="ticket" value="${ticket}">
        <button type="submit">Continue to Move</button>
      </form>
    </main>
    <script defer src="/move-handover.js"></script>
  </body>
</html>`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": `default-src 'none'; form-action ${moveOrigin}; script-src 'self'; style-src 'none'; base-uri 'none'; frame-ancestors 'none'`,
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function launchPortalApplication(
  request: Request,
  slug: string,
  options: ApplicationLaunchOptions,
) {
  const context = await getPortalContext();
  if (!context) {
    return options.unauthenticated === "login"
      ? redirectTo(request, "/login")
      : forbidden();
  }

  if (context.kind === "HQ_SUPPORT") {
    return unavailableResponse(request, options.unavailable);
  }

  const store = getPortalStore();
  if (context.kind === "MERCHANT_USER") {
    const accessSlugs = await store.listApplicationAccessSlugs(
      context.business.id,
      context.membershipId,
    );
    if (!accessSlugs.includes(slug)) {
      return unavailableResponse(request, options.unavailable);
    }
  }

  const application = (await store.listApplications(context.business.id)).find(
    (item) => item.slug === slug,
  );
  if (
    !application ||
    application.status !== "INSTALLED" ||
    !application.installedAt ||
    !application.launchUrl
  ) {
    return unavailableResponse(request, options.unavailable);
  }

  if (slug !== "move") {
    return unavailableResponse(request, options.unavailable);
  }

  try {
    const moveOrigin = parseMoveApplicationOrigin(application.launchUrl);
    if (moveOrigin !== getMoveApplicationOrigin()) {
      return unavailableResponse(request, options.unavailable);
    }

    const launch = createMoveLaunchTicket(
      context,
      application,
      getRequestOrigin(request),
    );
    return moveHandoverResponse(request, moveOrigin, launch.token);
  } catch {
    return unavailableResponse(request, options.unavailable);
  }
}
