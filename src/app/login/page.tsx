import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { Logo } from "@/components/logo";
import { MerchantIllustration } from "@/components/merchant-illustration";
import { getPortalContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getPortalContext()) {
    redirect("/portal");
  }

  const { error } = await searchParams;

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
          <h1>Welcome back</h1>
          <p>Sign in to manage your business.</p>
          <div className="login-rule" />
          <LoginForm hasError={error === "invalid"} />
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
