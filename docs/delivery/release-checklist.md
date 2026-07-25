# Release Checklist

This is the concrete proof gate referenced by [`staging-to-template.md`](staging-to-template.md) and by every capability's own contract tests ([`../capabilities/capability-contract.md`](../capabilities/capability-contract.md), [`../capabilities/capability-starter.md`](../capabilities/capability-starter.md)). A claim that this checklist passes is not evidence; a demonstrated run through it is.

## Capability launch sequence (first milestone: Move)

1. A Portal Owner logs into `template-staging.getedgeportal.app`.
2. The correct business/merchant record loads for that Owner.
3. The Apps screen shows Move from this merchant's `MerchantApplication` row.
4. A Portal user who is neither this merchant's Owner nor otherwise granted `PortalCapabilityAccess` for Move (see [`../platform/portal-architecture.md`](../platform/portal-architecture.md), "Who can do what") cannot see or launch Move, even though their merchant is entitled to it.
5. The Owner clicks Move. A signed launch ticket is issued and accepted by Move.
6. Move receives the correct `merchantId` and reflects the correct business — not a default, not the wrong merchant.
7. Move creates its own session; no second login prompt occurs anywhere in this flow.
8. `/move/ops` (or Move's equivalent authenticated area) opens successfully inside that session.
9. Direct access to a Move authenticated route without a valid launched session is rejected.
10. A launch ticket, once used, cannot be replayed to open a second session.
11. An expired launch ticket is rejected.

## Merchant deployment proof

Neither of the following two checks uses a real merchant — Edge's portal included — and neither involves pointing any merchant at `template-staging`. Both run against two dedicated, non-merchant verification projects — see [`staging-to-template.md`](staging-to-template.md) ("Verification deployments are not merchants") for what they are and why they exist. Each project holds its own `MerchantApplication` and `PortalCapabilityAccess` rows directly, in its own database, the same way every merchant deployment does.

12. **`portalapp-verify-create`** is torn down and recreated fresh from the release candidate commit, using a freshly generated merchant identity each run, and reaching a working state with known applications not installed. This exercises the exact mechanism a real merchant creation will use, without being one.
13. **`portalapp-verify-update`** — a persistent verification project, never deleted between runs, with one fixed merchant identity and stable application/access rows in its own database — is updated to the release candidate commit and continues to work with all existing data intact. This exercises the exact mechanism a real merchant update will use, without being one, and without requiring the candidate commit to already be certified.

## Passing bar

All items above must be demonstrated — screenshots, logs, or a recorded test run — not asserted in a summary. This mirrors the standing rule that a narrative completion report is not proof; the actual deployment state, build output, or functional test is.
