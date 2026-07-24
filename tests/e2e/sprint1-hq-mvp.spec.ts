import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const hqOrigin = "http://hq.localhost:3100";
const merchantOrigin = "http://ready-workshop.localhost:3100";
const evidenceDirectory = "output/playwright";

test.describe.configure({ retries: 0 });

test.beforeAll(async () => {
  await mkdir(evidenceDirectory, { recursive: true });
});

test("Sprint 1: Edge changes merchant readiness and opens its Portal", async ({
  browser,
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });

  await test.step("create the first Edge HQ account", async () => {
    await page.goto(`${hqOrigin}/setup`);
    await page.getByLabel("Edge Company Name").fill("Edge Payments");
    await page.getByLabel("Master Name").fill("Morgan Reed");
    await page.getByLabel("Email").fill("master@edge.example");
    await page.getByLabel("Password").fill("MasterPass123!");
    await page.getByRole("button", { name: "Create Master Account" }).click();

    await expect(page).toHaveURL(`${hqOrigin}/login?setup=complete`);
  });

  await test.step("Edge logs into HQ", async () => {
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await page.screenshot({
      path: `${evidenceDirectory}/01-hq-login.png`,
      fullPage: true,
    });
    await page.getByLabel("Email address").fill("master@edge.example");
    await page.getByLabel("Password", { exact: true }).fill("MasterPass123!");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(`${hqOrigin}/dashboard`);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  await test.step("Edge views the merchant list", async () => {
    await page.getByRole("link", { name: "Merchants", exact: true }).click();
    await expect(page).toHaveURL(`${hqOrigin}/merchants`);
    await expect(page.getByText("No merchants yet")).toBeVisible();
    await page.screenshot({
      path: `${evidenceDirectory}/02-merchant-list.png`,
      fullPage: true,
    });
  });

  await test.step("Edge creates a provisioning merchant directory record", async () => {
    await page.getByRole("link", { name: "New Merchant" }).first().click();
    await page.getByLabel("Business Name").fill("Provisioning Workshop");
    await page.getByLabel("Business Slug").fill("ready-workshop");
    await page.getByLabel("Portal URL").fill(merchantOrigin);
    await expect(page.getByLabel("Status")).toHaveValue("PROVISIONING");
    await page.screenshot({
      path: `${evidenceDirectory}/03-new-merchant.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Create Merchant" }).click();

    await expect(page).toHaveURL(/\/merchants\?created=ready-workshop$/);
    const provisioningRow = page
      .getByRole("row")
      .filter({ hasText: "Provisioning Workshop" });
    await expect(
      provisioningRow.getByLabel("Status for Provisioning Workshop"),
    ).toHaveValue("PROVISIONING");
    await expect(
      provisioningRow.getByText(merchantOrigin),
    ).toBeVisible();
    await expect(provisioningRow.getByText("Not ready", { exact: true })).toBeVisible();
    await expect(provisioningRow.getByRole("button", { name: "Open Merchant" })).toHaveCount(0);

    const provisioningBusinessId = await provisioningRow.getAttribute("data-business-id");
    expect(provisioningBusinessId).toBeTruthy();
    const blockedStatus = await page.evaluate(async (businessId) => {
      const response = await fetch("/api/merchant-access", {
        body: new URLSearchParams({ businessId: businessId! }),
        method: "POST",
      });
      return response.status;
    }, provisioningBusinessId);
    expect(blockedStatus).toBe(409);

    await page.screenshot({
      path: `${evidenceDirectory}/04-provisioning-merchant.png`,
      fullPage: true,
    });
  });

  await test.step("unauthorised and invalid status changes are rejected", async () => {
    const provisioningRow = page
      .getByRole("row")
      .filter({ hasText: "Provisioning Workshop" });
    const businessId = await provisioningRow.getAttribute("data-business-id");
    expect(businessId).toBeTruthy();

    const unauthorisedContext = await browser.newContext();
    const unauthorisedResponse = await unauthorisedContext.request.post(
      `${hqOrigin}/api/merchants/status`,
      {
        form: { businessId: businessId!, status: "READY" },
        headers: { origin: hqOrigin },
        maxRedirects: 0,
      },
    );
    expect([303, 307]).toContain(unauthorisedResponse.status());
    await unauthorisedContext.close();

    const invalidResponse = await page.request.post(
      `${hqOrigin}/api/merchants/status`,
      {
        form: { businessId: businessId!, status: "ACTIVE" },
        headers: { origin: hqOrigin },
        maxRedirects: 0,
      },
    );
    expect(invalidResponse.status()).toBe(400);
  });

  await test.step("HQ changes the merchant to ready", async () => {
    let merchantRow = page
      .getByRole("row")
      .filter({ hasText: "Provisioning Workshop" });
    await merchantRow
      .getByLabel("Status for Provisioning Workshop")
      .selectOption("READY");
    await merchantRow.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(/\/merchants\?updated=ready-workshop$/);
    await expect(page.getByText("Merchant status updated.")).toBeVisible();
    merchantRow = page
      .getByRole("row")
      .filter({ hasText: "Provisioning Workshop" });
    await expect(
      merchantRow.getByLabel("Status for Provisioning Workshop"),
    ).toHaveValue("READY");
    await expect(merchantRow.getByText(merchantOrigin, { exact: true })).toBeVisible();
    await expect(
      merchantRow.getByRole("button", { name: "Open Merchant" }),
    ).toBeVisible();
    await page.goto(`${hqOrigin}/merchants?updated=ready-workshop`);
    await expect(page.getByRole("heading", { name: "Merchants" })).toBeVisible();
    await page.screenshot({
      path: `${evidenceDirectory}/05-ready-merchant.png`,
      fullPage: true,
    });
  });

  await test.step("Edge opens the Merchant Portal with an HQ-managed session", async () => {
    const readyRow = page
      .getByRole("row")
      .filter({ hasText: "Provisioning Workshop" });
    await readyRow.getByRole("button", { name: "Open Merchant" }).click();

    await expect(page).toHaveURL(`${merchantOrigin}/dashboard`);
    await expect(page.getByText("Viewing as Edge Payments", { exact: true })).toBeVisible();
    await expect(page.getByText("Temporary HQ-managed access", { exact: false })).toBeVisible();
    await expect(page.getByText("Morgan Reed", { exact: true })).toBeVisible();
    await expect(page.getByText("HQ-managed", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Business", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Users", exact: true })).toHaveCount(0);

    const cookies = await page.context().cookies();
    expect(
      cookies.some(
        (cookie) =>
          cookie.name === "getedge_hq_session" &&
          cookie.domain === "hq.localhost",
      ),
    ).toBe(true);
    expect(
      cookies.some(
        (cookie) =>
          cookie.name === "getedge_hq_support_session" &&
          cookie.domain === "ready-workshop.localhost",
      ),
    ).toBe(true);
    expect(
      cookies.some(
        (cookie) =>
          cookie.name === "getedge_portal_session" &&
          cookie.domain === "ready-workshop.localhost",
      ),
    ).toBe(false);
    await page.screenshot({
      path: `${evidenceDirectory}/06-hq-managed-merchant.png`,
      fullPage: true,
    });
  });

  await test.step("changing back to provisioning removes Portal access", async () => {
    await page.goto(`${hqOrigin}/merchants`);
    let merchantRow = page
      .getByRole("row")
      .filter({ hasText: "Provisioning Workshop" });
    await merchantRow
      .getByLabel("Status for Provisioning Workshop")
      .selectOption("PROVISIONING");
    await merchantRow.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(/\/merchants\?updated=ready-workshop$/);
    merchantRow = page
      .getByRole("row")
      .filter({ hasText: "Provisioning Workshop" });
    await expect(
      merchantRow.getByLabel("Status for Provisioning Workshop"),
    ).toHaveValue("PROVISIONING");
    await expect(merchantRow.getByText("Not ready", { exact: true })).toBeVisible();
    await expect(
      merchantRow.getByRole("button", { name: "Open Merchant" }),
    ).toHaveCount(0);

    const businessId = await merchantRow.getAttribute("data-business-id");
    const blockedStatus = await page.evaluate(async (id) => {
      const response = await fetch("/api/merchant-access", {
        body: new URLSearchParams({ businessId: id! }),
        method: "POST",
      });
      return response.status;
    }, businessId);
    expect(blockedStatus).toBe(409);
    await page.screenshot({
      path: `${evidenceDirectory}/07-provisioning-restored.png`,
      fullPage: true,
    });
  });
});
