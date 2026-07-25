import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { MerchantIllustration } from "@/components/merchant-illustration";
import {
  hashMfaChallengeToken,
  HQ_MFA_CHALLENGE_COOKIE_NAME,
} from "@/lib/hq-auth/mfa";
import { getHQContext } from "@/lib/hq-auth/session";
import { getHQStore } from "@/lib/hq-store";
import { requirePageSurface } from "@/lib/surface";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify MFA" };

export default async function LoginMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePageSurface("HQ");
  const store = getHQStore();

  if (!(await store.isSetupComplete())) redirect("/setup");
  if (await getHQContext()) redirect("/dashboard");

  const cookieStore = await cookies();
  const token = cookieStore.get(HQ_MFA_CHALLENGE_COOKIE_NAME)?.value;
  const challenge = token
    ? await store.findMfaChallenge(hashMfaChallengeToken(token))
    : null;

  if (!challenge) {
    redirect("/login?error=expired");
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
          <strong>Two-step verification</strong>
          <span>HQ sessions require your password and authenticator code.</span>
        </div>
      </aside>
      <section className="login-workspace">
        <div className="login-card">
          <h1>Verify it&apos;s you</h1>
          <p>Enter the six-digit code from your authenticator app.</p>
          <div className="login-rule" />
          <form action="/api/hq-auth/mfa" className="login-form" method="post">
            {error === "invalid" ? (
              <p className="form-error" role="alert">
                The authenticator code was not recognised.
              </p>
            ) : null}
            <label htmlFor="code">Authenticator code</label>
            <input
              autoComplete="one-time-code"
              autoFocus
              id="code"
              inputMode="numeric"
              maxLength={6}
              minLength={6}
              name="code"
              pattern="[0-9]{6}"
              placeholder="000000"
              required
            />
            <button className="primary-button" type="submit">
              Verify and sign in
            </button>
          </form>
        </div>
        <MerchantIllustration />
      </section>
    </main>
  );
}
