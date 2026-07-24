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
          <span>This page is permanently disabled after the master account is created.</span>
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
                  : "Check the details and try again."}
              </p>
            ) : null}
            <label htmlFor="companyName">Edge Company Name</label>
            <input id="companyName" name="companyName" required />
            <label htmlFor="masterName">Master Name</label>
            <input autoComplete="name" id="masterName" name="masterName" required />
            <label htmlFor="email">Email</label>
            <input autoComplete="email" id="email" name="email" required type="email" />
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
            <button className="primary-button form-submit" type="submit">
              Create Master Account
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
