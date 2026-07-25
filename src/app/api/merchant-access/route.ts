import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/auth/csrf";
import { createHQAccessTicket } from "@/lib/hq-access/ticket";
import { requireHQContext } from "@/lib/hq-auth/session";
import { getHQStore } from "@/lib/hq-store";
import { requireRequestSurface } from "@/lib/surface";

const requestSchema = z.object({
  businessId: z.string().min(1),
});

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function POST(request: Request) {
  if (!requireRequestSurface(request, "HQ")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (!isSameOriginRequest(request)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const context = await requireHQContext();
  const parsed = requestSchema.safeParse(
    Object.fromEntries((await request.formData()).entries()),
  );

  if (!parsed.success) {
    return new NextResponse("Invalid merchant selection.", { status: 400 });
  }

  const store = getHQStore();
  const business = await store.findVisibleBusiness(
    parsed.data.businessId,
    context.hq.id,
    context.hq.type,
  );

  if (!business) {
    return new NextResponse("Merchant not found.", { status: 404 });
  }

  if (business.status !== "READY" || !business.portalUrl) {
    return new NextResponse("Merchant is not ready.", { status: 409 });
  }

  const ticket = createHQAccessTicket(context, business);
  await store.recordTicketIssued({
    auditIdentifier: ticket.payload.auditIdentifier,
    businessId: business.id,
    originHqId: context.hq.id,
    originHqName: context.hq.name,
    hqUserId: context.user.id,
    operatorName: context.user.name,
    operatorUsername: context.user.username,
    accessMode: ticket.payload.accessMode,
    ticketIssuedAt: new Date(ticket.payload.issuedAt * 1000),
    expiresAt: new Date(ticket.payload.expiresAt * 1000),
  });

  const exchangeUrl = new URL("/api/support/exchange", business.portalUrl);
  const html = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Opening merchant Portal</title></head>
  <body>
    <form id="merchant-access" action="${escapeHtml(exchangeUrl.toString())}" method="post">
      <input type="hidden" name="ticket" value="${escapeHtml(ticket.token)}">
      <noscript><button type="submit">Continue to ${escapeHtml(business.name)}</button></noscript>
    </form>
    <script>document.getElementById("merchant-access").submit();</script>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": `default-src 'none'; script-src 'unsafe-inline'; form-action ${exchangeUrl.origin}; base-uri 'none'; frame-ancestors 'none'`,
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
    },
  });
}
