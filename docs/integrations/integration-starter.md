# Integration Starter

The standard scaffold a new integration begins from, matching the lifecycle in [`integration-contract.md`](integration-contract.md).

## Required paths / pieces

- **Provider manifest** — static description of the third-party system, the OAuth scopes or API credentials it needs, and which webhooks it subscribes to.
- **`connect` flow** — initiates OAuth (or captures an API key) for a specific merchant, and stores the resulting credential scoped to that merchant only.
- **`configure` UI/API** — merchant-facing mapping of third-party resources to Portal/capability resources (e.g. "this Monday.com board maps to this Payment Link template").
- **`test` action** — a sandboxed or dry-run check confirming the configuration works before going live, run on demand and before first enabling.
- **Webhook receiver** — validates inbound signatures/secrets, deduplicates by delivery ID, and processes idempotently so a redelivered webhook doesn't double-apply an action.
- **Status endpoint** — reports connected/degraded/disconnected and the timestamp and detail of the last successful and last failed operation.
- **`disconnect` action** — revokes stored credentials at the provider (where the provider's API supports revocation) and marks the integration inactive for that merchant, not merely hidden from the UI.

## Examples this scaffold should fit

- **Monday.com → Payment Links**: board-item webhook triggers creation of a Portal Hosted Checkout Payment Link, status written back to the board item.
- **WooCommerce → Hosted Checkout**: order-created webhook creates a Portal Hosted Checkout session, payment status synced back to the WooCommerce order.
- **Xero → Reporting/reconciliation**: scheduled sync pushes Portal settlement data into Xero for reconciliation; no inbound webhook required, but the same connect/configure/status/disconnect shape applies.

## What is intentionally not in the starter

No launch ticket handling, no capability session, no independent payment credentials. If a third-party connector needs any of those, it is not an integration under this contract and should be reconsidered as a capability instead.
