import { describe, expect, it } from "vitest";
import {
  canAccessArea,
  canInstallMove,
  canManageBusiness,
  canManageUsers,
  visiblePortalAreas,
} from "@/lib/auth/authorization";

describe("Portal role access", () => {
  it.each(["OWNER", "ADMIN", "MANAGER", "USER"] as const)(
    "shows the focused merchant navigation to %s",
    (role) => {
      expect(canAccessArea(role, "BUSINESS")).toBe(true);
      expect(canAccessArea(role, "USERS")).toBe(true);
      expect(canAccessArea(role, "APPS")).toBe(true);
      expect(visiblePortalAreas(role)).toEqual(["BUSINESS", "USERS", "APPS"]);
    },
  );

  it("keeps mutations with Owner and Admin merchant users", () => {
    expect(canManageBusiness("OWNER")).toBe(true);
    expect(canManageBusiness("ADMIN")).toBe(true);
    expect(canManageBusiness("MANAGER")).toBe(false);
    expect(canManageBusiness("USER")).toBe(false);
    expect(canManageUsers("OWNER")).toBe(true);
    expect(canManageUsers("ADMIN")).toBe(true);
    expect(canManageUsers("HQ_SUPPORT")).toBe(false);
    expect(canInstallMove("OWNER")).toBe(true);
    expect(canInstallMove("ADMIN")).toBe(true);
    expect(canInstallMove("MANAGER")).toBe(false);
    expect(canInstallMove("USER")).toBe(false);
    expect(canInstallMove("HQ_SUPPORT")).toBe(false);
  });

  it("grants Edge sessions full merchant-management authority", () => {
    expect(canManageBusiness("EDGE")).toBe(true);
    expect(canManageUsers("EDGE")).toBe(true);
    expect(canInstallMove("EDGE")).toBe(true);
  });

  it("allows an HQ-managed session to view the merchant milestone", () => {
    expect(canAccessArea("HQ_SUPPORT", "BUSINESS")).toBe(true);
    expect(canAccessArea("HQ_SUPPORT", "USERS")).toBe(true);
    expect(canAccessArea("HQ_SUPPORT", "APPS")).toBe(true);
  });
});
