import { getPortalStore } from "@/lib/portal-store";
import type { PortalStore } from "@/lib/portal-store/types";

export const HQ_ACCESS_NONCE_RETENTION_DAYS = 30;

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

type RunHQAccessCleanupOptions = {
  now?: Date;
  store?: PortalStore;
};

export async function runHQAccessCleanup({
  now = new Date(),
  store = getPortalStore(),
}: RunHQAccessCleanupOptions = {}) {
  const nonceConsumedBefore = new Date(
    now.getTime() - HQ_ACCESS_NONCE_RETENTION_DAYS * DAY_IN_MILLISECONDS,
  );
  const result = await store.cleanupHQAccessRecords({
    supportSessionExpiresAt: now,
    nonceConsumedBefore,
  });

  return {
    ...result,
    nonceRetentionDays: HQ_ACCESS_NONCE_RETENTION_DAYS,
  };
}
