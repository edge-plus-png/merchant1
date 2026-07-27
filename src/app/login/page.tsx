import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { Logo } from "@/components/logo";
import { MerchantIllustration } from "@/components/merchant-illustration";
import { getPortalContext } from "@/lib/auth/session";
import { getPortalStore } from "@/lib/portal-store";
import { getHQContext } from "@/lib/hq-auth/session";
import { getHQStore } from "@/lib/hq-store";
import { getPortalSurface } from "@/lib/surface";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    invited?: string;
    reset?: string;
    setup?: string;
    state?: string;
  }>;
}) {
  const surface = await getPortalSurface();
  const requestHeaders = await headers();

  if (surface === "HQ") {
    if (!(await getHQStore().isSetupComplete())) {
      redirect("/setup");
    }

    if (await getHQContext()) {
      redirect("/dashboard");
    }
  } else if (await getPortalContext()) {
    redirect("/business");
  }

  const { error, invited, reset, setup, state } = await searchParams;
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const merchantBusiness =
    surface === "MERCHANT" && host
      ? await getPortalStore().findLocalBusiness(`${protocol}://${host}`)
      : null;

  return (
    <main className="login-page">
      <aside className="login-brand-panel">
        <Logo linked={false} />
        <div className="login-security-copy">
          <span className="security-mark" aria-hidden="true">
            ✓
          </span>
          <strong>Your security is our priority.</strong>
          <span>All connections are encrypted and your data is protected.</span>
        </div>
      </aside>
      <section className="login-workspace">
        <div className="login-card">
          <h1>{surface === "HQ" ? "HQ access" : "Welcome back"}</h1>
          <p>
            {surface === "HQ"
              ? "Sign in to manage authorised merchants."
              : "Sign in to manage your business."}
          </p>
          <div className="login-rule" />
          {setup === "complete" ? (
            <p className="success-notice login-success" role="status">
              Master account created. Sign in to continue.
            </p>
          ) : null}
          {invited === "accepted" ? (
            <p className="success-notice login-success" role="status">
              Your account is ready. Sign in to continue.
            </p>
          ) : null}
          {reset === "accepted" ? (
            <p className="success-notice login-success" role="status">
              Your password has been updated. Sign in to continue.
            </p>
          ) : null}
          {error === "expired" ? (
            <p className="form-error" role="alert">
              Your MFA sign-in expired. Enter your username and password again.
            </p>
          ) : null}
          <LoginForm
            action={surface === "HQ" ? "/api/hq-auth/login" : "/api/auth/login"}
            hasError={error === "invalid"}
            identifier={
              surface === "HQ" || merchantBusiness?.usernameLoginEnabledAt
                ? "username"
                : "email"
            }
            returnState={surface === "MERCHANT" ? state : undefined}
          />
        </div>
        <MerchantIllustration />
        <p className="login-footnote">
          <span aria-hidden="true">▢</span>
          For your security, please sign out and close your browser when you&apos;re
          done.
        </p>
      </section>
    </main>
  );
}
