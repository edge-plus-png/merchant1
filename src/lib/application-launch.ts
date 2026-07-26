import "server-only";

import { NextResponse } from "next/server";
import { fetchCapabilityManifest } from "@/lib/application-routing/manifest";
import { createApplicationReturnState } from "@/lib/application-routing/return-state";
import { createCapabilityLaunchTicket } from "@/lib/application-routing/ticket";
import { getPortalContext } from "@/lib/auth/session";
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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function applicationHandoverResponse(
  slug: string,
  applicationName: string,
  ticket: string,
) {
  const handoverUrl = `/apps/${slug}/__launch`;
  const safeName = escapeHtml(applicationName);
  const body = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Opening ${safeName}</title>
    <link rel="stylesheet" href="/application-handover.css">
  </head>
  <body data-handover-state="pending">
    <main class="handover-shell" id="application-handover-status" aria-live="polite">
      <span class="handover-mark" aria-hidden="true">E</span>
      <h1>Opening ${safeName}</h1>
      <p id="application-handover-message">Your secure handover is in progress.</p>
      <form id="application-handover" action="${handoverUrl}" method="post">
        <input type="hidden" name="ticket" value="${ticket}">
        <button type="submit">Continue to ${safeName}</button>
      </form>
    </main>
    <script defer src="/application-handover.js"></script>
  </body>
</html>`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; connect-src 'self'; form-action 'self'; script-src 'self'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'",
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
      ? redirectTo(
          request,
          `/login?state=${encodeURIComponent(
            createApplicationReturnState(`/apps/${slug}`),
          )}`,
        )
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

  try {
    const manifest = await fetchCapabilityManifest(application);
    const launch = createCapabilityLaunchTicket(
      context,
      application,
      manifest,
      getRequestOrigin(request),
    );
    return applicationHandoverResponse(
      slug,
      application.name,
      launch.token,
    );
  } catch {
    return unavailableResponse(request, options.unavailable);
  }
}
