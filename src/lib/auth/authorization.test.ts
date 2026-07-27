import { describe, expect, it } from "vitest";
import {
  canAccessArea,
  canInstallApplication,
  canManageBusiness,
  canManageUsers,
  canResetPassword,
  visiblePortalAreas,
} from "@/lib/auth/authorization";

describe("Portal role access", () => {
  it.each(["OWNER", "ADMIN", "MANAGER", "USER", "LITE"] as const)(
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
    expect(canManageBusiness("LITE")).toBe(false);
    expect(canManageUsers("OWNER")).toBe(true);
    expect(canManageUsers("ADMIN")).toBe(true);
    expect(canManageUsers("HQ_SUPPORT")).toBe(false);
    expect(canInstallApplication("OWNER")).toBe(true);
    expect(canInstallApplication("ADMIN")).toBe(true);
    expect(canInstallApplication("MANAGER")).toBe(false);
    expect(canInstallApplication("USER")).toBe(false);
    expect(canInstallApplication("LITE")).toBe(false);
    expect(canInstallApplication("HQ_SUPPORT")).toBe(false);
  });

  it("enforces the password reset permission matrix", () => {
    expect(canResetPassword("EDGE", "OWNER")).toBe(true);
    expect(canResetPassword("OWNER", "OWNER")).toBe(true);
    expect(canResetPassword("ADMIN", "MANAGER")).toBe(true);
    expect(canResetPassword("MANAGER", "ADMIN")).toBe(true);
    expect(canResetPassword("ADMIN", "OWNER")).toBe(false);
    expect(canResetPassword("MANAGER", "OWNER")).toBe(false);
    expect(canResetPassword("USER", "USER")).toBe(false);
    expect(canResetPassword("LITE", "USER")).toBe(false);
  });

  it("grants Edge sessions full merchant-management authority", () => {
    expect(canManageBusiness("EDGE")).toBe(true);
    expect(canManageUsers("EDGE")).toBe(true);
    expect(canInstallApplication("EDGE")).toBe(true);
  });

  it("allows an HQ-managed session to view the merchant milestone", () => {
    expect(canAccessArea("HQ_SUPPORT", "BUSINESS")).toBe(true);
    expect(canAccessArea("HQ_SUPPORT", "USERS")).toBe(true);
    expect(canAccessArea("HQ_SUPPORT", "APPS")).toBe(true);
  });
});
