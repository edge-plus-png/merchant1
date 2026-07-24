import { isDemoMode } from "@/lib/env";
import { demoHQStore } from "@/lib/hq-store/demo-store";
import { prismaHQStore } from "@/lib/hq-store/prisma-store";

export function getHQStore() {
  return isDemoMode() ? demoHQStore : prismaHQStore;
}
