import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApplicationCard } from "@/components/application-card";
import type { MerchantApplicationRecord } from "@/lib/portal-types";

const now = new Date("2026-07-26T12:00:00.000Z");
const move: MerchantApplicationRecord = {
  id: "move-1",
  businessId: "business-1",
  slug: "move",
  name: "Move",
  summary: "Manage Move",
  status: "INSTALLED",
  launchUrl: "https://move-staging.getedgeportal.app",
  installedAt: now,
  createdAt: now,
  updatedAt: now,
};

describe("ApplicationCard", () => {
  it("opens an installed application through its bookmarkable GET route", () => {
    const html = renderToStaticMarkup(
      createElement(ApplicationCard, {
        application: move,
        canInstall: true,
        canOpen: true,
        openUnavailableReason: "Unavailable",
      }),
    );

    expect(html).toContain('href="/apps/move"');
    expect(html).toContain("Open Move");
    expect(html).not.toContain("/api/portal/apps/move/open");
    expect(html).not.toContain('<form action="/apps/move"');
  });
});
