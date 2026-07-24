# Portal Architecture

## What Portal is

Portal is the control plane. It is the only system that owns identity, merchant records, payments, and shared settings. Everything else — Move, Events, Storefront, and any future first-party feature — is a **capability**: an independently built and independently deployed application that Portal launches a user into, and that Portal has granted a specific merchant access to.

Portal owns, exclusively:

- Login and Portal user accounts (Owner, Admin, and merchant-scoped roles)
- Business/merchant records (one merchant = one Portal-managed record, regardless of how many capabilities that merchant uses)
- Capability access: which capability definitions exist, and which merchants are entitled to which capabilities
- Payments: Hosted Checkout, Virtual Terminal, Pay by Link, NMI gateway configuration, and all payment execution
- Integrations: the connectors to third-party systems (Monday.com, Xero, WooCommerce, Shopify, etc.)
- Shared settings: branding, currency, timezone, notification recipients, retention windows

Portal does **not** own capability-internal data. Move's device/session state, Events' bookings, and Storefront's catalog and orders live inside those capabilities' own databases, not Portal's.

## Where platform data lives

Every merchant has its own fully isolated Vercel project and database (see [`deployment-and-vercel-model.md`](deployment-and-vercel-model.md), [`merchant-deployment-model.md`](merchant-deployment-model.md)) — a merchant's own users, sessions, and business data never live anywhere else. That isolation is for merchant data specifically. It does not extend to the handful of things that are, by definition, cross-merchant: the one Platform Organisation, the `CapabilityDefinition` registry, `MerchantCapability` grants, and the launch-ticket signing key.

`PortalCapabilityAccess` is deliberately **not** in that list. Unlike `MerchantCapability` (a Platform Administrator granting one merchant access, which is inherently a cross-merchant action performed by someone outside that merchant), `PortalCapabilityAccess` is a merchant's own Owner/Admin deciding which of their own Portal users may use a capability their merchant already holds — a wholly merchant-local decision about merchant-local users. It lives in that merchant's own database, alongside its Portal user accounts, not in the Registry.

These live in a single, dedicated, central data store — the **Platform Registry** — which is not part of any merchant's database and is not Template's build artifact either. It is deployed once per environment tier: `portalapp-registry-staging` backs `template-staging` and every verification/staging merchant; `portalapp-registry-production` backs `template` and every real production merchant. See [`deployment-and-vercel-model.md`](deployment-and-vercel-model.md) for the project entries.

A merchant's own Portal deployment queries the Platform Registry live, at request time (rendering the Apps screen, verifying a launch), rather than keeping its own synced copy — the Registry is the one authoritative source for "does this capability exist" and "is this merchant entitled to it," the same way a capability queries the Registry's public key live rather than hardcoding it (see [`../capabilities/signed-launch-ticket.md`](../capabilities/signed-launch-ticket.md)). Platform Administrator write access (registering a `CapabilityDefinition`, granting a `MerchantCapability`) is authenticated against the Platform Organisation record in the Registry itself, not against any merchant's database.

**This is a deliberate, accepted shared dependency, not an exception to merchant isolation.** The "one merchant's problem stays scoped to one merchant" principle in [`merchant-deployment-model.md`](merchant-deployment-model.md) is about merchant *data* and merchant *deployment changes* (a bad update to one merchant's code/data must not touch another's) — it was never a claim that merchants have zero live runtime dependencies outside their own database. Every merchant already depends on Portal's own NMI gateway configuration and payment execution being reachable; the Registry is the same kind of small, dedicated, high-availability shared service, scoped to exactly the data that is cross-merchant by definition. A Registry outage degrades capability launch and the Apps screen for every merchant on that tier simultaneously — this is accepted as the cost of having a single, unambiguous source of truth for capability entitlements, rather than reintroducing per-merchant capability registries that could drift from each other.

## Capabilities vs. integrations

These are two different relationships and must not be conflated.

**A capability** is a first-party application (Move, Events, Storefront) that:
- is deployed independently of Portal, with its own Vercel project(s) and database
- is launched by a Portal user, into a session inside the capability, via a signed launch ticket (see [`../capabilities/signed-launch-ticket.md`](../capabilities/signed-launch-ticket.md))
- is registered once, globally, as a `CapabilityDefinition` (this capability exists and can be launched)
- is granted to a merchant as a `MerchantCapability` (this specific merchant may launch it)
- has no shared cookies, sessions, or database with Portal — see [`../decisions/0004-no-shared-cookies.md`](../decisions/0004-no-shared-cookies.md)

**An integration** is a connection to a third-party system (Monday.com, Xero, WooCommerce, Shopify) that:
- runs inside Portal's own connection/webhook infrastructure, not as a separately deployed app
- is connected, configured, and authorized per-merchant through OAuth or API credentials
- consumes Portal capabilities (e.g. an integration creates a Hosted Checkout Payment Link) rather than being launched into
- follows the lifecycle in [`../integrations/integration-contract.md`](../integrations/integration-contract.md), not the capability lifecycle

If it is a full application a user is taken to and works inside, it is a capability. If it is a background connector that reacts to events or calls Portal on a merchant's behalf, it is an integration.

## The three-table capability access model

1. **`CapabilityDefinition`** — one row per capability that exists at all (Move, Events, Storefront). Created once, by a Platform Administrator. Holds the capability's identity, its launch URL, its health-check URL, and the contract version it implements. Does not reference any merchant.
2. **`MerchantCapability`** — one row per (merchant, capability) grant. Created or removed by a Platform Administrator to entitle or revoke a merchant's access to a capability. A merchant with no `MerchantCapability` row for a capability cannot see or launch it, regardless of `CapabilityDefinition` existing.
3. **`PortalCapabilityAccess`** — one row per (Portal user, merchant capability) permission. Controls which of a merchant's own Portal users may launch a capability that merchant is entitled to. A merchant Owner can grant or revoke this for their own users; they cannot grant it for capabilities their merchant isn't entitled to. The merchant's Owner receives this automatically the moment a `MerchantCapability` grant is created, so there is always at least one person at the merchant able to reach and delegate access to the capability; every other Portal user at that merchant starts with no access to it until their Owner/Admin grants it explicitly.

This replaces the old registration → approval → activation pairing ceremony entirely. See [`../decisions/0002-capabilities-vs-integrations.md`](../decisions/0002-capabilities-vs-integrations.md) and [`../capabilities/capability-contract.md`](../capabilities/capability-contract.md).

## Who can do what

There is exactly one **Platform Organisation**. It is not a merchant, not created via any merchant onboarding path, and not identified by an environment variable. It is the organisation created during a Portal deployment's own bootstrap (see [`../decisions/0006-platform-administrator-authority.md`](../decisions/0006-platform-administrator-authority.md)).

- **Platform Administrators** (members of the Platform Organisation) may create and register `CapabilityDefinition` rows, and may create or remove `MerchantCapability` grants for any merchant.
- **Merchant Owners/Admins** may only toggle `PortalCapabilityAccess` for their own merchant's own Portal users, scoped to capabilities their merchant already holds a `MerchantCapability` grant for. They cannot register new capabilities and cannot grant themselves access to a capability they haven't been entitled to.
- A capability itself has no concept of a "Portal user" — see [`../capabilities/signed-launch-ticket.md`](../capabilities/signed-launch-ticket.md) for what identity a capability actually receives at launch.

## Open questions

None outstanding as of this writing. The platform-administrator authentication question is resolved in [`../decisions/0006-platform-administrator-authority.md`](../decisions/0006-platform-administrator-authority.md).
