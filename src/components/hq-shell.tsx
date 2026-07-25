import type { ReactNode } from "react";
import { HQNavigation } from "@/components/hq-navigation";
import { Logo } from "@/components/logo";
import type { HQContext } from "@/lib/portal-types";

export function HQShell({
  context,
  children,
}: {
  context: HQContext;
  children: ReactNode;
}) {
  return (
    <div className="hq-shell">
      <aside className="hq-sidebar">
        <Logo destination="/dashboard" />
        <div className="hq-sidebar-label">
          <span>HQ</span>
          <strong>{context.hq.name}</strong>
        </div>
        <HQNavigation />
      </aside>
      <div className="hq-workspace">
        <header className="hq-header">
          <div>
            <strong>{context.hq.name}</strong>
            <span>Edge HQ</span>
          </div>
          <div className="account-identity">
            <span className="account-avatar" aria-hidden="true">
              {context.user.name.charAt(0)}
            </span>
            <span className="account-copy">
              <strong>{context.user.name}</strong>
              <span>Master account</span>
            </span>
            <form action="/api/hq-auth/logout" method="post">
              <button className="sign-out-button" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="hq-content">{children}</main>
      </div>
    </div>
  );
}
