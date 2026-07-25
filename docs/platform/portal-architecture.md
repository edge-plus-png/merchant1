# Portal Architecture

## The three products

GetEdgePortal consists of three products with separate identity and session boundaries:

1. **HQ** — the cross-merchant management product for Edge and affiliate organisations.
2. **Merchant Portal** — the merchant control plane. Each merchant uses only its own Portal deployment and business context.
3. **Capabilities** — independently deployed first-party applications launched by Merchant Portal in a merchant context.

HQ is not a route area or role inside Merchant Portal. Merchant Portal is not a business selector or a view into HQ. A capability is not an extension of either product's session.

## What Merchant Portal owns

Merchant Portal owns merchant identity, merchant records, payments, and shared settings. Move, Events, Storefront, and any future first-party feature remain capabilities that Merchant Portal launches for an entitled merchant.

Merchant Portal owns, exclusively:

- Login and Portal user accounts (Owner, Admin, and merchant-scoped roles)
- Business/merchant records (one merchant = one Portal-managed record, regardless of how many capabilities that merchant uses)
- Capability access: which capability definitions exist, and which merchants are entitled to which capabilities
- Payments: Hosted Checkout, Virtual Terminal, Pay by Link, NMI gateway configuration, and all payment execution
- Integrations: the connectors to third-party systems (Monday.com, Xero, WooCommerce, Shopify, etc.)
- Shared settings: branding, currency, timezone, notification recipients, retention windows

Portal does **not** own capability-internal data. Move's device/session state, Events' bookings, and Storefront's catalog and orders live inside those capabilities' own databases, not Portal's.

## Where platform data lives

Every merchant has its own fully isolated Vercel project and database (see [`deployment-and-vercel-model.md`](deployment-and-vercel-model.md), [`merchant-deployment-model.md`](merchant-deployment-model.md)) — a merchant's own users, sessions, and business data never live anywhere else.

`CapabilityDefinition`, `MerchantCapability`, `PortalCapabilityAccess`, and the launch-ticket signing key all live in that same merchant's own Merchant Portal database, and are held and used by that Merchant Portal deployment directly. There is no separate, centrally-deployed data store for this. Merchant Portal owns launch tickets; it signs and verifies them itself, using its own key, against its own copy of which capabilities exist and which this merchant is entitled to.

This is deliberately simple. A shared cross-deployment registry service is real infrastructure, and today there is exactly one capability (Move) and one launch contract — introducing a shared service now would be solving a problem that doesn't exist yet. If, once several capabilities (Move, Events, Storefront, Retail, Tap) are all issuing structurally identical launch tickets, the signing and verification code is genuinely duplicated across every Merchant Portal deployment in a way that causes real drift or maintenance cost, extracting a shared issuer service at that point is a reasonable evolution. That would be an implementation change, not a contract change: the ticket shape and verification rules in [`../capabilities/signed-launch-ticket.md`](../capabilities/signed-launch-ticket.md) don't need to move for the thing that signs them to move. Until that's a real, demonstrated problem, Merchant Portal owning this directly is the right amount of infrastructure.

How `CapabilityDefinition` rows come to exist consistently across every merchant's own database (so that "Move exists and can be launched" is the same fact everywhere) is a question for how Template itself is built and promoted ([`deployment-and-vercel-model.md`](deployment-and-vercel-model.md), [`../delivery/staging-to-template.md`](../delivery/staging-to-template.md)), not a question that needs new cross-merchant infrastructure to answer.

## Capabilities vs. integrations

These are two different relationships and must not be conflated.

**A capability** is a first-party application (Move, Events, Storefront) that:
- is deployed independently of Portal, with its own Vercel project(s) and database
- is launched by a Portal user, into a session inside the capability, via a signed launch ticket (see [`../capabilities/signed-launch-ticket.md`](../capabilities/signed-launch-ticket.md))
- is registered once, globally, as a `CapabilityDefinition` (this capability exists and can be launched)
- is granted to a merchant as a `MerchantCapability` (this specific merchant may launch it)
- has no shared cookies, sessions, or database with Portal — see [`../decisions/0004-no-shared-cookies.md`](../decisions/0004-no-shared-cookies.md)

**An integration** is a connection to a third-party system (Monday.com, Xero, WooCommerce, Shopify, Klaviyo) that:
- runs inside Portal's own connection/webhook infrastructure, not as a separately deployed app
- is connected, configured, and authorized per-merchant through OAuth or API credentials
- extends exactly one thing — either Merchant Platform directly, or one specific application — rather than being launched into (see [`../integrations/integration-contract.md`](../integrations/integration-contract.md), "Scope: what an integration extends", for examples)
- follows the lifecycle in [`../integrations/integration-contract.md`](../integrations/integration-contract.md), not the capability lifecycle

If it is a full application a user is taken to and works inside, it is a capability, and it appears on the Apps screen (currently: Move, Events, Storefront, Retail, Tap). If it is a background connector that reacts to events or calls Portal or a specific application on a merchant's behalf, it is an integration, and it never appears on the Apps screen regardless of what it extends.

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

## What HQ owns

HQ owns HQ identities, memberships, HQ sessions, the merchant directory visible to HQ, affiliate-to-business assignments, merchant-access ticket issuance, and HQ-side audit evidence. Edge HQ has global business visibility; affiliate HQ visibility is derived only from explicit assignments.

An authorised HQ operator may enter a merchant's own Portal through a signed, short-lived, one-use merchant-access ticket. Merchant Portal creates a separately typed HQ-managed session. The operator remains an HQ identity and is never made a merchant Owner, merchant user, or `BusinessMembership` member. Merchant Portal displays an unambiguous HQ-managed-session indicator.

The HQ-to-Merchant ticket and session are separate from the Merchant Portal-to-capability launch ticket and session. See [`hq-architecture.md`](hq-architecture.md), [`hq-data-model.md`](hq-data-model.md), and [`../decisions/0007-hq-merchant-access.md`](../decisions/0007-hq-merchant-access.md).

## Product identity boundaries

- HQ users authenticate only to HQ. An HQ membership grants no merchant membership and no capability account.
- Merchant users authenticate only to their own Merchant Portal. They cannot use HQ routes or exchange HQ merchant-access tickets.
- Capabilities receive a merchant-context launch, not an HQ identity to provision as an application user.
- Platform Administrator authority (see [`../decisions/0006-platform-administrator-authority.md`](../decisions/0006-platform-administrator-authority.md)) remains a separate authorization plane from HQ; Edge HQ membership does not implicitly create Platform Administrator authority.
- Cookies and sessions are host-scoped and are not shared across products.

## Open questions

HQ-specific questions still requiring a decision are recorded in [`hq-architecture.md`](hq-architecture.md). The platform-administrator authentication question remains resolved in [`../decisions/0006-platform-administrator-authority.md`](../decisions/0006-platform-administrator-authority.md).
