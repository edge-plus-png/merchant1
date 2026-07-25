import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getHQContext } from "@/lib/hq-auth/session";
import { getHQStore } from "@/lib/hq-store";
import { requirePageSurface } from "@/lib/surface";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Create Edge master account" };

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePageSurface("HQ");
  const store = getHQStore();

  if (await store.isSetupComplete()) {
    redirect((await getHQContext()) ? "/dashboard" : "/login");
  }

  const { error } = await searchParams;

  return (
    <main className="setup-page">
      <aside className="setup-brand-panel">
        <Logo linked={false} />
        <div>
          <strong>First deployment setup</strong>
          <span>
            This page is permanently disabled after the master account and MFA are
            configured.
          </span>
        </div>
      </aside>
      <section className="setup-workspace">
        <div className="setup-card">
          <div className="page-heading compact-heading">
            <h1>Create Edge Master Account</h1>
            <p>Set up the Edge HQ organisation and its first administrator.</p>
          </div>
          <form action="/api/setup" className="stacked-form" method="post">
            {error ? (
              <p className="form-error" role="alert">
                {error === "exists"
                  ? "Setup has already been completed."
                  : error === "expired"
                    ? "The MFA setup expired. Enter the account details again."
                    : error === "password_mismatch"
                      ? "The passwords do not match."
                      : "Check the details and try again."}
              </p>
            ) : null}
            <label htmlFor="companyName">Edge Company Name</label>
            <input id="companyName" name="companyName" required />
            <label htmlFor="masterName">Master Name</label>
            <input autoComplete="name" id="masterName" name="masterName" required />
            <label htmlFor="username">Username</label>
            <input
              autoCapitalize="none"
              autoComplete="username"
              id="username"
              maxLength={64}
              minLength={3}
              name="username"
              pattern="[A-Za-z0-9._-]+"
              required
            />
            <p className="field-help">
              Use 3–64 letters, numbers, dots, underscores or hyphens.
            </p>
            <label htmlFor="password">Password</label>
            <input
              autoComplete="new-password"
              id="password"
              minLength={12}
              name="password"
              required
              type="password"
            />
            <p className="field-help">Use at least 12 characters.</p>
            <label htmlFor="passwordConfirm">Confirm password</label>
            <input
              autoComplete="new-password"
              id="passwordConfirm"
              minLength={12}
              name="passwordConfirm"
              required
              type="password"
            />
            <button className="primary-button form-submit" type="submit">
              Continue to MFA
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
