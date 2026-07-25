# Integration Contract

## How integrations differ from capabilities

A capability is launched into: a Portal user clicks Apps, is handed a signed ticket, and lands inside a separately deployed application with its own session. An integration is not launched into and has no session a Portal user works inside — it is a background connection to a third-party system, configured once per merchant and then running unattended (reacting to webhooks, calling out to the third party, calling back into Portal). See [`../platform/portal-architecture.md`](../platform/portal-architecture.md) for the distinguishing rule.

An integration consumes a contract rather than being launched by Portal — for example, an integration that creates a Payment Link from a Monday.com board item is a caller of Portal's Hosted Checkout capability, not a thing Portal hands a user off to. See [`../platform/payment-ownership.md`](../platform/payment-ownership.md).

## Scope: what an integration extends

An integration extends exactly one thing: either Merchant Platform directly, or one specific application. It is never scoped to more than one target at a time, and Merchant Portal does not need to know or care which — an integration's provider definition names its own target, and that target's own contract (Merchant Platform's, or the specific application's) is what the integration is built and tested against.

Examples of each: Monday.com extends Merchant Platform directly (it reacts to merchant/business-level events, not any one application's internals). Xero extends Move specifically (it consumes whatever contract Move exposes for accounting sync, not a Merchant Platform-wide one). WooCommerce may extend Storefront, or the Payment Platform, or both, depending on what it's actually wired to do for that merchant. Klaviyo extends Events specifically.

An integration scoped to a specific application follows that application's own contract for whatever it consumes there, the same way a launched capability's internals are that capability's own concern — Merchant Portal's documentation does not, and must not, describe what an application-scoped integration does inside that application beyond the fact that the integration exists and is connected.

Regardless of scope, an integration is never one of the platform's launched applications and never appears on the Apps screen — the Apps screen shows only the applications a merchant can launch into (Move, Events, Storefront, Retail, Tap), never the integrations extending them or Merchant Platform. Where an integration is surfaced (e.g. under Settings, or a dedicated Integrations area) is a UI placement question, not a boundary question, and is not decided by this document.

## Integration lifecycle

1. **Connect** — merchant authorizes Portal to access the third-party system, typically via OAuth, scoped per merchant.
2. **Configure** — merchant sets resource mappings (which Monday.com board, which WooCommerce store, which Xero organisation) and any integration-specific settings.
3. **Test** — a dry run or sandbox check confirms the configuration is valid before it's allowed to run live.
4. **Enable** — the integration begins reacting to real events/webhooks for that merchant.
5. **Monitor** — operational status (last successful sync, last error, connection health) is visible to the merchant and authorized Edge support.
6. **Disconnect** — the merchant or authorized Edge support revokes the connection; credentials are invalidated, not merely hidden.

## What an integration must provide

- **Provider definition** — which third-party system this is, and what capabilities of that system it uses (webhooks it subscribes to, API scopes it requests)
- **Connection/authentication** — how credentials are obtained and stored (OAuth token, API key) — always per merchant, never shared across merchants
- **Configuration** — the merchant-specific mapping between the third-party system's resources and Portal/capability resources
- **Webhook handling** — how inbound events from the third party are validated (signature/secret check) and processed, including retry and replay behavior for failed or duplicate deliveries
- **Operational status** — a merchant-visible and Platform-visible state: connected, degraded, disconnected, last error
- **Audit history** — every configuration change and every consequential action (e.g. a payment link created) is attributable to when and why

## What an integration does not do

- It does not hold its own payment gateway credentials. Any money-moving action goes through Portal's payment ownership as described in [`../platform/payment-ownership.md`](../platform/payment-ownership.md).
- It does not get its own signed launch ticket or capability session — that mechanism is capability-only, see [`../capabilities/signed-launch-ticket.md`](../capabilities/signed-launch-ticket.md).
- It does not provision Portal users or capability users. An integration acts on a merchant's behalf as a service account, not as a stand-in for a person.
