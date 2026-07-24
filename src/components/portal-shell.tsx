import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { PortalNavigation } from "@/components/portal-navigation";
import { visiblePortalAreas } from "@/lib/auth/authorization";
import type { PortalContext } from "@/lib/portal-types";

function formatRole(role: PortalContext["role"]) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export function PortalShell({
  context,
  children,
}: {
  context: PortalContext;
  children: ReactNode;
}) {
  return (
    <div className="portal-shell">
      <aside className="portal-sidebar">
        <Logo />
        <PortalNavigation areas={visiblePortalAreas(context.role)} />
      </aside>
      <div className="portal-workspace">
        <header className="portal-header">
          <div className="business-identity">
            <strong>{context.business.name}</strong>
            <span>{context.business.slug}</span>
          </div>
          <div className="account-identity">
            <span className="account-avatar" aria-hidden="true">
              {context.user.name.charAt(0)}
            </span>
            <span className="account-copy">
              <strong>{context.user.name}</strong>
              <span>{formatRole(context.role)}</span>
            </span>
            <form action="/api/auth/logout" method="post">
              <button className="sign-out-button" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="portal-content">{children}</main>
      </div>
    </div>
  );
}
