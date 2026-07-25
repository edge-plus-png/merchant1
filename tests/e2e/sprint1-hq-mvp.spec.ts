import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { generateTotpCode } from "@/lib/hq-auth/mfa";

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
  await page.setViewportSize({ width: 1440, height: 1024 });
  let mfaSecret = "";

  await test.step("create the first Edge HQ account", async () => {
    await page.goto(`${hqOrigin}/setup`);
    await page.getByLabel("Edge Company Name").fill("Edge Payments");
    await page.getByLabel("Master Name").fill("Morgan Reed");
    await page.getByLabel("Username").fill("edge.master");
    await page.getByLabel("Password", { exact: true }).fill("MasterPass123!");
    await page.getByLabel("Confirm password").fill("DifferentPass123!");
    await page.getByRole("button", { name: "Continue to MFA" }).click();

    await expect(page).toHaveURL(`${hqOrigin}/setup?error=password_mismatch`);
    await expect(
      page.getByText("The passwords do not match.", { exact: true }),
    ).toBeVisible();

    await page.getByLabel("Edge Company Name").fill("Edge Payments");
    await page.getByLabel("Master Name").fill("Morgan Reed");
    await page.getByLabel("Username").fill("edge.master");
    await page.getByLabel("Password", { exact: true }).fill("MasterPass123!");
    await page.getByLabel("Confirm password").fill("MasterPass123!");
    await page.getByRole("button", { name: "Continue to MFA" }).click();

    await expect(page).toHaveURL(`${hqOrigin}/setup/mfa`);
    mfaSecret = (await page.locator("code").innerText()).trim();
    await page.getByLabel("Authenticator code").fill("000000");
    await page
      .getByRole("button", { name: "Verify and Create Master Account" })
      .click();
    await expect(page).toHaveURL(`${hqOrigin}/setup/mfa?error=invalid`);
    await expect(page.getByRole("alert")).toContainText(
      "The authenticator code was not recognised.",
    );
    await page.getByLabel("Authenticator code").fill(generateTotpCode(mfaSecret));
    await page
      .getByRole("button", { name: "Verify and Create Master Account" })
      .click();

    await expect(page).toHaveURL(`${hqOrigin}/login?setup=complete`);
  });

  await test.step("Edge logs into HQ", async () => {
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await page.screenshot({
      path: `${evidenceDirectory}/01-hq-login.png`,
      fullPage: true,
      caret: "initial",
    });
    await page.getByLabel("Username").fill("edge.master");
    await page.getByLabel("Password", { exact: true }).fill("MasterPass123!");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(`${hqOrigin}/login/mfa`);
    await page.goto(`${hqOrigin}/dashboard`);
    await expect(page).toHaveURL(`${hqOrigin}/login`);
    await page.goto(`${hqOrigin}/login/mfa`);
    await page.getByLabel("Authenticator code").fill("000000");
    await page.getByRole("button", { name: "Verify and sign in" }).click();
    await expect(page).toHaveURL(`${hqOrigin}/login/mfa?error=invalid`);
    await expect(page.getByRole("alert")).toContainText(
      "The authenticator code was not recognised.",
    );
    await page.getByLabel("Authenticator code").fill(generateTotpCode(mfaSecret));
    await page.getByRole("button", { name: "Verify and sign in" }).click();

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
      caret: "initial",
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
      caret: "initial",
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
      caret: "initial",
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
      caret: "initial",
    });
  });

  await test.step("Edge opens the Merchant Portal with full setup authority", async () => {
    const readyRow = page
      .getByRole("row")
      .filter({ hasText: "Provisioning Workshop" });
    await readyRow.getByRole("button", { name: "Open Merchant" }).click();

    await expect(page).toHaveURL(`${merchantOrigin}/business`);
    await expect(page.getByText("Morgan Reed", { exact: true })).toBeVisible();
    await expect(page.getByText("Viewing as", { exact: false })).toHaveCount(0);
    await expect(page.getByText("HQ-managed access", { exact: false })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Business profile" })).toBeVisible();
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("link", { name: "Business profile" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Users", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "My Apps", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Take A Payment" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Link Management" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Virtual Terminal" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Pay by Link" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Xero" })).toHaveCount(0);
    await page.getByRole("button", { name: "Close navigation" }).click();
    await expect(page.getByLabel("Legal business name")).toBeEnabled();
    await page.getByLabel("Legal business name").fill("Edge Setup Ltd");
    await page.getByLabel("Support email").fill("setup@example.com");
    await page.getByLabel("Business contact name").fill("Edge Setup");
    await page.getByLabel("Business contact phone").fill("+44 20 7946 0958");
    await page.getByLabel("Address line 1").fill("1 Setup Street");
    await page.getByLabel("Town / city").fill("London");
    await page.getByLabel("Postcode").fill("SW1A 1AA");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/business\?saved=1$/);
    await expect(page.getByText("Business information saved.")).toBeVisible();

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
      path: `${evidenceDirectory}/06-merchant-business.png`,
      fullPage: true,
      caret: "initial",
    });

    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("link", { name: "Users", exact: true }).click();
    await expect(page).toHaveURL(`${merchantOrigin}/users`);
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await expect(page.getByText("Invite team member")).toBeVisible();
    await page.getByLabel("Full name").fill("Setup Owner");
    await page.getByLabel("Email").fill("setup-owner@example.com");
    await page.getByLabel("Role").selectOption("OWNER");
    await page.getByRole("button", { name: "Create invite" }).click();
    await expect(page.getByText("Invitation created")).toBeVisible();
    await page.screenshot({
      path: `${evidenceDirectory}/07-merchant-users.png`,
      fullPage: true,
      caret: "initial",
    });

    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("link", { name: "My Apps", exact: true }).click();
    await expect(page).toHaveURL(`${merchantOrigin}/apps`);
    await expect(page.getByRole("heading", { name: "My Apps" }).first()).toBeVisible();
    await expect(page.getByText("This page is a placeholder.")).toBeVisible();
    await page.screenshot({
      path: `${evidenceDirectory}/08-merchant-apps.png`,
      fullPage: true,
      caret: "initial",
    });
  });

  await test.step("the merchant Owner updates Business and invites an Admin", async () => {
    await page.getByRole("button", { name: "Sign Out" }).click();
    await expect(page).toHaveURL(`${merchantOrigin}/login`);
    await page.getByLabel("Email address").fill("owner@ready-workshop.example");
    await page.getByLabel("Password", { exact: true }).fill("OwnerPass123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(`${merchantOrigin}/business`);

    await page.getByLabel("Legal business name").fill("Provisioning Workshop Ltd");
    await page.getByLabel("Support email").fill("support@ready-workshop.example");
    await page.getByLabel("Business contact name").fill("Merchant Owner");
    await page.getByLabel("Business contact phone").fill("+44 20 7946 0958");
    await page.getByLabel("Address line 1").fill("1 Victoria Street");
    await page.getByLabel("Town / city").fill("Manchester");
    await page.getByLabel("Postcode").fill("M3 1AE");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page).toHaveURL(`${merchantOrigin}/business?saved=1`);
    await expect(page.getByText("Business information saved.")).toBeVisible();
    await page.screenshot({
      path: `${evidenceDirectory}/10-owner-business-saved.png`,
      fullPage: false,
      caret: "initial",
    });

    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("link", { name: "Users", exact: true }).click();
    await page.getByLabel("Full name").fill("Alex Admin");
    await page.getByLabel("Email", { exact: true }).fill("alex@ready-workshop.example");
    await page.getByLabel("Role", { exact: true }).selectOption("ADMIN");
    await page.getByRole("button", { name: "Create invite" }).click();

    await expect(page.getByText("Invitation created", { exact: true })).toBeVisible();
    const invitationUrl = await page.getByLabel("Invitation link").inputValue();
    expect(invitationUrl).toContain("/invite/");
    await page.screenshot({
      path: `${evidenceDirectory}/11-owner-user-invitation.png`,
      fullPage: true,
      caret: "initial",
    });

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(`${merchantOrigin}/login`);
    await page.goto(invitationUrl);
    await expect(page.getByRole("heading", { name: "Join the team" })).toBeVisible();
    await page.getByLabel("Create password").fill("AdminPass123!");
    await page.getByLabel("Confirm password").fill("AdminPass123!");
    await page.getByRole("button", { name: "Accept invitation" }).click();

    await expect(page).toHaveURL(`${merchantOrigin}/login?invited=accepted`);
    await page.getByLabel("Email address").fill("alex@ready-workshop.example");
    await page.getByLabel("Password", { exact: true }).fill("AdminPass123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("link", { name: "Users", exact: true }).click();
    await expect(
      page.getByRole("row").filter({ hasText: "alex@ready-workshop.example" }),
    ).toContainText("Admin");
    await page.screenshot({
      path: `${evidenceDirectory}/12-admin-users.png`,
      fullPage: true,
      caret: "initial",
    });

    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("link", { name: "My Apps", exact: true }).click();
    await expect(page.getByRole("heading", { name: "My Apps" }).first()).toBeVisible();
    await expect(page.getByText("This page is a placeholder.")).toBeVisible();
    await page.screenshot({
      path: `${evidenceDirectory}/13-admin-apps.png`,
      fullPage: true,
      caret: "initial",
    });
  });

  await test.step("the migrated merchant layout works on mobile", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${merchantOrigin}/users`);
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await expect(page.getByText("Invite team member")).toBeVisible();

    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("link", { name: "Take A Payment" })).toBeVisible();
    await expect(page.getByRole("link", { name: "My Apps" })).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 1024 });
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
      path: `${evidenceDirectory}/17-provisioning-restored.png`,
      fullPage: true,
      caret: "initial",
    });
  });
});
