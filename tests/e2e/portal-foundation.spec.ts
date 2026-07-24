import { expect, test } from "@playwright/test";

test("Owner login resolves the business and reaches foundation areas", async ({
  page,
  request,
}) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

  await page.getByLabel("Email address").fill("owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill("OwnerPass123!");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByText("Edge Demo Business", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("business-id")).toHaveText(/\S+/);

  await page.getByRole("link", { name: "Users" }).click();
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "owner@example.com" })).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByText("Europe/London")).toBeVisible();

  await page.getByRole("link", { name: "Apps" }).click();
  await expect(page).toHaveURL(/\/portal\/apps$/);
  await expect(page.getByRole("heading", { name: "Apps" })).toBeVisible();
  await expect(page.getByText("No applications available")).toBeVisible();

  const health = await request.get("/api/health");
  expect(health.ok()).toBe(true);
  await expect(health.json()).resolves.toMatchObject({ status: "ok" });
});

test("Lite account cannot see or directly access Apps", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("lite@example.com");
  await page.getByLabel("Password", { exact: true }).fill("LitePass123!");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByRole("navigation").getByRole("link", { name: "Apps" })).toHaveCount(0);

  await page.goto("/portal/apps");
  await expect(page).toHaveURL(/\/portal\?denied=apps$/);
  await expect(
    page.getByText("You do not have access to Apps.", { exact: true }),
  ).toBeVisible();
});

test("unauthenticated Portal routes return to login", async ({ page }) => {
  await page.goto("/portal/users");
  await expect(page).toHaveURL(/\/login$/);
});

test("captures native-size visual evidence", async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: "docs/design/login-implementation.png",
    fullPage: false,
  });

  await page.getByLabel("Email address").fill("owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill("OwnerPass123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/portal/apps");
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: "docs/design/portal-shell-implementation.png",
    fullPage: false,
  });
});
