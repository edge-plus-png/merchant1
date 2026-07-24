import { describe, expect, it } from "vitest";
import {
  canAccessArea,
  visiblePortalAreas,
} from "@/lib/auth/authorization";

describe("Portal role access", () => {
  it.each(["OWNER", "ADMIN"] as const)(
    "allows %s to reach Users, Settings, and Apps",
    (role) => {
      expect(canAccessArea(role, "USERS")).toBe(true);
      expect(canAccessArea(role, "SETTINGS")).toBe(true);
      expect(canAccessArea(role, "APPS")).toBe(true);
    },
  );

  it("keeps Lite in the shell but denies Apps", () => {
    expect(canAccessArea("LITE", "OVERVIEW")).toBe(true);
    expect(canAccessArea("LITE", "APPS")).toBe(false);
    expect(visiblePortalAreas("LITE")).toEqual(["OVERVIEW"]);
  });
});
