# Platform Overview

One diagram. No implementation detail, no routes, no data models — read [`portal-architecture.md`](portal-architecture.md) for that. This page exists so someone new to the project understands the shape of the architecture in about thirty seconds, before reading anything else.

```
                         HQ
                          │
                          ▼
                 Merchant Platform
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
  Payment Platform   Integrations          Apps
                                              │
                                              ▼
                                        Applications
                                              │
                                              ▼
                                  Application Internals
                                  (owned entirely by
                                   each application)
```

Four layers, each with one job:

**Merchant Platform** owns identity, the merchant record, users, launch, the Payment Platform, and integration management.

**Applications** (Move, Events, Storefront, Retail, Tap) own their own sessions, UI, workflows, and business data. Merchant Platform launches them and nothing more — see [`../decisions/0011-applications-are-sovereign.md`](../decisions/0011-applications-are-sovereign.md).

**Application Internals** belong entirely to each application's own team. Merchant Platform has no view into this layer and no opinion on it — see [`../decisions/0014-portal-does-not-own-application-product-decisions.md`](../decisions/0014-portal-does-not-own-application-product-decisions.md).

**Integrations** (Xero, WooCommerce, Monday, Klaviyo, ...) extend exactly one thing each — either Merchant Platform directly, or one specific application — never both. See [`../integrations/integration-contract.md`](../integrations/integration-contract.md).

HQ sits above Merchant Platform as a separate product with its own identity and session boundary, entering a merchant's own Merchant Platform only through a signed, short-lived merchant-access ticket — see [`hq-architecture.md`](hq-architecture.md).
