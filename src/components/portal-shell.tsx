import type { ReactNode } from "react";
import { PortalNavigation } from "@/components/portal-navigation";
import type { PortalContext } from "@/lib/portal-types";

function formatRole(role: PortalContext["role"]) {
  if (role === "HQ_SUPPORT") {
    return "HQ support";
  }

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
      <div className="portal-workspace">
        {context.kind === "HQ_SUPPORT" ? (
          <div className="hq-support-banner" role="status">
            <strong>Viewing as {context.support.hqName}</strong>
            <span>
              Temporary HQ-managed access · Audit{" "}
              <code>{context.support.auditIdentifier}</code>
            </span>
          </div>
        ) : null}
        <PortalNavigation
          businessName={context.business.name}
          environment={context.business.status === "READY" ? "Live" : "Staging"}
          logoutAction={
            context.kind === "HQ_SUPPORT"
              ? "/api/support/logout"
              : "/api/auth/logout"
          }
          logoutLabel={context.kind === "HQ_SUPPORT" ? "End access" : "Sign Out"}
          role={formatRole(context.role)}
          userName={context.user.name}
        />
        <main className="portal-content">{children}</main>
      </div>
    </div>
  );
}
