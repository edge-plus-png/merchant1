# 0002 — Capabilities vs. Integrations

## Decision

First-party applications entered from Merchant Portal (Move, Events, Storefront) are **capabilities**: independently deployed, registered globally, entitled per merchant, and launched by Merchant Portal via signed ticket. The requesting Merchant Portal principal is normally a merchant user and may be an HQ-managed session when its access mode permits launch; neither identity is provisioned as a capability application user. Connections to third-party systems (Monday.com, Xero, WooCommerce, Shopify) are **integrations**: configured per merchant, running unattended in the background, consuming Portal capabilities rather than being launched into. These are two different lifecycles and are never merged into one model.

## Why

Contract 2.0 treated Move/Events/Storefront pairing and third-party connectors as similar enough to eventually converge, which is what produced Events' own bespoke shared-secret launch mechanism and a general blurring of "thing with a UI a user works inside" versus "thing that reacts to webhooks on a merchant's behalf." Naming the distinction explicitly prevents a future integration from acquiring launch-ticket machinery it doesn't need, and prevents a future capability from being treated as a mere background connector.

## Alternatives rejected

- **One unified "app" concept covering both** — rejected because the two have fundamentally different session models (a capability has a user-facing session; an integration does not) and different credential models (an integration holds third-party OAuth tokens; a capability holds none of Portal's payment credentials).
- **Integrations get their own lighter-weight launch ticket** — rejected; integrations have no session to launch into, so there is nothing for a launch ticket to authorize.

## Consequences

Anything proposed as a new "app" must be classified as one or the other before design work starts, using the test in [`../platform/portal-architecture.md`](../platform/portal-architecture.md): if it's a full application a user is taken to and works inside, it's a capability; if it's a background connector, it's an integration.
