import { isDemoMode } from "@/lib/env";
import { demoPortalStore } from "@/lib/portal-store/demo-store";
import { prismaPortalStore } from "@/lib/portal-store/prisma-store";

export function getPortalStore() {
  return isDemoMode() ? demoPortalStore : prismaPortalStore;
}
