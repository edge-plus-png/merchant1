import { beforeEach, describe, expect, it } from "vitest";
import { demoHQStore } from "@/lib/hq-store/demo-store";
import {
  getDemoState,
  resetDemoState,
} from "@/lib/portal-store/demo-store";

describe("HQ merchant status audit", () => {
  beforeEach(() => {
    resetDemoState();
  });

  it("persists the previous status, new status, operator and timestamp", async () => {
    const master = await demoHQStore.createEdgeMaster({
      companyName: "Edge Payments",
      masterName: "Morgan Reed",
      username: "edge.master",
      passwordHash: "test-hash",
      mfaSecretCiphertext: "encrypted-secret",
      mfaEnabledAt: new Date(),
    });
    expect(master.status).toBe("created");
    if (master.status !== "created") return;

    const merchant = await demoHQStore.createMerchant({
      name: "Ready Workshop",
      slug: "ready-workshop",
      portalUrl: "http://ready-workshop.localhost:3100",
      status: "PROVISIONING",
    });
    const operator = master.membership.user;
    const hq = master.membership.hq;

    await demoHQStore.changeMerchantStatus({
      businessId: merchant.id,
      newStatus: "READY",
      hqId: hq.id,
      hqUserId: operator.id,
      operatorName: operator.name,
      operatorUsername: operator.username,
    });
    await demoHQStore.changeMerchantStatus({
      businessId: merchant.id,
      newStatus: "PROVISIONING",
      hqId: hq.id,
      hqUserId: operator.id,
      operatorName: operator.name,
      operatorUsername: operator.username,
    });

    const audits = (await getDemoState()).hqMerchantStatusAudits;
    expect(audits).toHaveLength(2);
    expect(audits[0]).toMatchObject({
      businessId: merchant.id,
      previousStatus: "PROVISIONING",
      newStatus: "READY",
      hqId: hq.id,
      hqUserId: operator.id,
      operatorName: "Morgan Reed",
      operatorUsername: "edge.master",
    });
    expect(audits[0]?.createdAt).toBeInstanceOf(Date);
    expect(audits[1]).toMatchObject({
      businessId: merchant.id,
      previousStatus: "READY",
      newStatus: "PROVISIONING",
    });
  });
});
