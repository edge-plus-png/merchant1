# Documentation QA Log

## 2026-07-25 — entitlement model reconciliation

The live architecture corpus was reconciled with the implemented merchant data
model.

Verified outcomes:

- `MerchantApplication` is the only merchant/application installation record.
- `PortalCapabilityAccess` remains per merchant membership and application
  slug; it is not a single per-user boolean.
- The duplicate application identity column was removed; `capabilitySlug`
  remains the application key.
- no application-definition or catalogue table is part of the model.
- Applications launch with the generic signed ticket and continue through the
  canonical `/apps/{slug}/...` gateway route to their independent origins.
- Portal contains no embedded Move route, Move session, or Move runtime data.

The corpus was searched after reconciliation for obsolete entitlement
terminology; no live references remain.
