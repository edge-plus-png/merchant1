# Portal Application Routing Contract

**Status:** accepted 2026-07-26
**Owner:** Merchant Portal
**Approver:** Kevin
**Wire version:** `GETEDGE-CAPABILITY+JWT` v1
**Routing-manifest version:** `portalRouting.version = 1`

This is the canonical application-routing contract for `merchant1` and every
capability it launches. It is a new design. The reverted Multi Zones
implementation is not a reference implementation and must not be restored.

## Canonical URLs

Portal permanently owns:

- `/apps` — the merchant's application list;
- `/apps/{slug}` — the authenticated, bookmarkable launch entry; and
- `/apps/{slug}/...` — authenticated capability screens during that session.

The slug is a stable registry identifier. Routing is driven by the merchant's
`MerchantApplication` row and the capability manifest. No Portal source route,
matcher, cookie constant, or ticket profile is added for a new capability.

## Routing boundary

A dedicated stateless application gateway owns the public merchant origin. It
is separate from the Portal application runtime:

1. Exact `/apps/{slug}` is handled by Portal. Portal authenticates the current
   principal, applies installation and `PortalCapabilityAccess` checks, loads
   and validates the registered capability manifest, and issues a signed
   launch ticket.
2. `/apps/{slug}/__launch` is forwarded by the gateway to the registered
   capability's `/api/portal-launch` using the registered application origin as
   the actual upstream request origin and Host.
3. `/apps/{slug}/...` is forwarded to the capability after removing the public
   mount prefix. Same-capability `Location` responses are translated back into
   the canonical Portal namespace.
4. The capability uses mount-neutral application links and the same stable
   asset namespace on its sovereign origin. It never receives or constructs an
   `/apps/{slug}` base path.

The gateway is a narrow pass-through. It has no session store, database, token
cache, request-body log, cookie log, or error detail containing supplied values.
Cookie and ticket values may exist only transiently in request memory while the
request is forwarded. Vercel access paths must never contain these values.

## Capability manifest

Every registered origin publishes `/.well-known/getedge-capability.json`:

```json
{
  "schemaVersion": 1,
  "slug": "move",
  "name": "Move",
  "contractVersion": "1.0",
  "applicationOrigin": "https://move-staging.getedgeportal.app",
  "environment": "staging",
  "launchUrl": "https://move-staging.getedgeportal.app/api/portal-launch",
  "healthUrl": "https://move-staging.getedgeportal.app/api/health",
  "portalLaunchKeyPath": "/.well-known/getedge-portal-launch-key",
  "portalRouting": {
    "version": 1,
    "sessionCookie": {
      "name": "counter_ops_session"
    },
    "assetPrefix": "/_getedge/capability-assets/move"
  }
}
```

Validation is fail-closed:

- `schemaVersion` and `portalRouting.version` are integer literal `1`.
- `slug` matches `^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$` and equals the
  registry slug.
- `applicationOrigin` is an HTTPS origin and exactly equals the registered
  `MerchantApplication.launchUrl` origin.
- `launchUrl` and `healthUrl` share that origin. The launch path is exactly
  `/api/portal-launch` and the health path is exactly `/api/health`.
- `environment` is `staging` or `production`.
- `portalLaunchKeyPath` is the stable Portal public-key endpoint shown above.
- `sessionCookie.name` matches `^[A-Za-z0-9_-]{1,64}$` and must not collide
  with a Portal or HQ reserved cookie name.
- `assetPrefix` is exactly `/_getedge/capability-assets/{slug}`. It has no
  trailing slash, dot segment, query, fragment, or encoded slash.

## Generic signed ticket

Every capability uses exactly one Ed25519 ticket profile:

- header `alg`: `EdDSA`;
- header `typ`: `GETEDGE-CAPABILITY+JWT`;
- header `kid`: the Portal signing-key identifier;
- `audience`: registered slug;
- `applicationOrigin`: registered trusted application origin;
- `environment`: manifest environment;
- `entitlement.slug`: registered slug; and
- merchant, initiator, installation, nonce, `issuedAt`, `expiresAt`, issuer and
  Portal origin claims as defined in `signed-launch-ticket.md`.

Tickets are short-lived and single-use. Capabilities compare audience, origin,
environment and entitlement slug to their own validated manifest/release data.
There are no application-specific claim templates or legacy ticket profiles.

## Session and cookie isolation

Portal and capability sessions are independent. The gateway applies an
allowlist at both boundaries:

- Portal-bound requests contain only Portal-owned cookie names.
- Capability-bound requests contain only that manifest's declared session
  cookie.
- Capability `Set-Cookie` responses may set only the declared cookie.
- The gateway removes `Domain` and forces `Secure`, `HttpOnly`, `SameSite=Lax`
  and `Path=/apps/{slug}/` on the public merchant origin.
- Undeclared capability cookies are rejected rather than forwarded.
- Direct capability-origin cookies retain their capability-owned root path.

The gateway necessarily receives raw request cookies, but Portal application
code never receives a capability token and capability code never receives a
Portal token. The gateway never persists, caches or logs either value.

Logging out of Portal does not end a capability session. Logging out of a
capability does not end the Portal session.

## Security and assets

- A capability creates its session only after full ticket verification,
  including nonce replay protection.
- Authenticated capability routes reject a Portal-only request and reject a
  direct-origin request without a launched capability session.
- Authenticated responses are `no-store`.
- When a capability supplies a CSP, the gateway preserves `frame-ancestors`
  and narrows capability `self` sources to that capability's canonical
  application and asset paths. When a capability supplies no CSP, the gateway
  issues a fail-closed policy with `frame-ancestors 'none'`, a capability-only
  `form-action`, a namespaced asset-only `script-src`, and no Portal or sibling
  capability asset source. The generated policy permits Next.js' inline
  bootstrap script but no inline script attributes.
- Portal's assets remain under `/_next`. Capability framework and public assets
  live only under `/_getedge/capability-assets/{slug}`. Asset routing uses the
  slug registry and never a per-application matcher.

## Login return state

An unauthenticated application bookmark redirects to `/login` with a signed,
short-lived state containing only `returnPath`, `issuedAt`, `expiresAt` and a
UUID nonce. `returnPath` is restricted to exact local `/apps/{slug}` entries.
The nonce is persisted and consumed atomically after successful authentication;
replay falls back to the normal Portal landing page.

## Automated contract suite

Release requires executable tests proving:

1. An entitled authenticated merchant launches without a second login.
2. An unauthenticated bookmark returns to that capability after login.
3. Missing access and missing installation have the same unavailable result.
4. Portal and capability cookies coexist in the browser while neither reaches
   the other application's server.
5. A Portal-only session is rejected by the capability.
6. Anonymous direct-origin capability access is rejected.
7. Two deployed fixture capabilities return their own namespaced assets without
   shadowing or cache contamination.
8. A third fixture is added through registry and manifest data only.
9. A known test token never appears in gateway runtime/error logs after success
   or failure requests.

## Coordinated release

The generic ticket has no dual-format transition. Release and rollback are
paired across repositories:

1. Build both immutable Git candidates.
2. Deploy the Move verifier to staging first.
3. Enable/deploy the Portal issuer and gateway only after Move staging is READY.
4. Run the cross-repository staging contract suite.
5. Deploy the Move production verifier first, followed by Portal/gateway.
6. Roll back to the paired previous Move and Portal/gateway deployments if the
   contract fails at either stage.

No production issuer may emit the new profile before its registered capability
verifier is ready.
