import type { PortalRole } from "@/lib/portal-types";

export type PortalArea = "BUSINESS" | "USERS" | "APPS";
export type PortalActorRole = PortalRole | "HQ_SUPPORT" | "EDGE";

const portalAreas: PortalArea[] = ["BUSINESS", "USERS", "APPS"];

export function canAccessArea(_role: PortalActorRole, area: PortalArea) {
  return portalAreas.includes(area);
}

export function visiblePortalAreas(role: PortalRole): PortalArea[] {
  void role;
  return portalAreas;
}

export function canManageBusiness(role: PortalActorRole) {
  return role === "OWNER" || role === "ADMIN" || role === "EDGE";
}

export function canManageUsers(role: PortalActorRole) {
  return role === "OWNER" || role === "ADMIN" || role === "EDGE";
}

export function canInstallApplication(role: PortalActorRole) {
  return role === "OWNER" || role === "ADMIN" || role === "EDGE";
}
