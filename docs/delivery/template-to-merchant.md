# Template → Merchant

Two distinct actions, both manual, both scoped to exactly one merchant at a time. See [`../platform/merchant-deployment-model.md`](../platform/merchant-deployment-model.md) for the underlying rule.

## Creating a new merchant

1. Take the current certified Template state (`portalapp-template` at its current commit).
2. Deploy it into a new, dedicated Vercel project for this merchant, with a new, dedicated database.
3. Run the merchant's own bootstrap/initial setup against that new database (Owner account creation, organisation record).
4. Confirm the merchant can log in and sees no capabilities until explicitly entitled (see [`../platform/portal-architecture.md`](../platform/portal-architecture.md)).

A new merchant never starts from `template-staging`, and never inherits another merchant's data or configuration.

## Updating an existing merchant

1. Choose the certified Template commit to update this merchant to (not necessarily Template's latest — a merchant can be deliberately held back).
2. Deploy that commit into this merchant's own existing Vercel project (same database, same domain).
3. Confirm the merchant's data and capability entitlements are unaffected by the update — an update changes Portal's own code, not the merchant's records or grants.
4. This is done for one merchant at a time. A problem found during one merchant's update does not propagate to any other merchant, because no other merchant was touched.

## What triggers this

Nothing automatic. A Template promotion (see [`staging-to-template.md`](staging-to-template.md)) makes a new certified state available; it does not, by itself, initiate any merchant creation or update. Both are separate, deliberate actions taken afterward.
