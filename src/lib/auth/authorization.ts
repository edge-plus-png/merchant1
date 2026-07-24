import type { PortalRole } from "@/lib/portal-types";

export type PortalArea = "OVERVIEW" | "USERS" | "SETTINGS" | "APPS";

const managementRoles = new Set<PortalRole>(["OWNER", "ADMIN"]);

export function canAccessArea(role: PortalRole, area: PortalArea) {
  if (area === "OVERVIEW") {
    return true;
  }

  return managementRoles.has(role);
}

export function visiblePortalAreas(role: PortalRole): PortalArea[] {
  return (["OVERVIEW", "USERS", "SETTINGS", "APPS"] as const).filter((area) =>
    canAccessArea(role, area),
  );
}
