import type { PortalRole } from "@/lib/portal-types";

export type PortalArea = "DASHBOARD";
export type PortalActorRole = PortalRole | "HQ_SUPPORT";

export function canAccessArea(_role: PortalActorRole, area: PortalArea) {
  return area === "DASHBOARD";
}

export function visiblePortalAreas(role: PortalRole): PortalArea[] {
  void role;
  return ["DASHBOARD"];
}
