import { describe, expect, it } from "vitest";
import {
  canAccessArea,
  visiblePortalAreas,
} from "@/lib/auth/authorization";

describe("Portal role access", () => {
  it.each(["OWNER", "ADMIN", "MEMBER", "LITE"] as const)(
    "allows %s to reach the merchant dashboard",
    (role) => {
      expect(canAccessArea(role, "DASHBOARD")).toBe(true);
      expect(visiblePortalAreas(role)).toEqual(["DASHBOARD"]);
    },
  );

  it("allows an HQ-managed session into the dashboard only", () => {
    expect(canAccessArea("HQ_SUPPORT", "DASHBOARD")).toBe(true);
  });
});
