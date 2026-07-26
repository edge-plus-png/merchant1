# Signed Launch Ticket

This is the single SSO mechanism used by every first-party capability — Move, Events, Storefront, and any future capability. It replaces Events' existing shared-secret launch approach entirely; no capability keeps its own bespoke launch scheme. See [`../decisions/0003-signed-launch-ticket.md`](../decisions/0003-signed-launch-ticket.md).

## Mechanism

Asymmetric signing. Each Merchant Portal deployment holds its own signing private key directly and signs its own launch tickets — there is no separate signing service today (see [`../platform/portal-architecture.md`](../platform/portal-architecture.md), "Where platform data lives," for why this is deliberately simple for now). When an authorized Merchant Portal principal requests a launch, that merchant's own Portal deployment signs the ticket itself, using its own key, and sends it directly to the capability. The principal is normally a merchant user, but may be a merchant-local HQ-managed session when its access mode permits the action. Capabilities never hold the private key — they fetch the issuing Merchant Portal deployment's current public key (via the reference published in the capability's own `.well-known/getedge-capability.json`, see [`capability-starter.md`](capability-starter.md)) and use it only to verify signatures. A capability that can verify a ticket cannot forge one.

If, once several capabilities are all consuming structurally identical tickets from several Merchant Portal deployments, signing and verification becomes real duplicated work worth extracting, a shared issuer can be introduced later as an implementation change — the ticket shape and verification rules below don't need to move for that to happen.

## Ticket shape

The protected header uses `alg: EdDSA`,
`typ: GETEDGE-CAPABILITY+JWT`, and the Portal signing-key `kid`.

| Field | Meaning |
|---|---|
| `issuer` | Fixed identifier `getedge-merchant-portal` |
| `audience` | The capability slug this ticket is valid for (e.g. `move`) — a ticket issued for one capability must be rejected by any other |
| `portalOrigin` | Origin of the issuing Merchant Portal and its public-key endpoint |
| `applicationOrigin` | Registered trusted origin of the receiving capability |
| `merchant.id` | The merchant this session is for |
| `merchant.name` | Display name for the capability UI; `merchant.id` remains authoritative |
| `environment` | `staging` or `production` — a ticket issued for one must be rejected by a capability instance running in the other |
| `initiatedBy` | Opaque Merchant Portal principal reference; Edge full-access uses the fixed value `edge-full-access` and sends no operator identity |
| `entitlement.applicationId` | Merchant-local installation record identifier |
| `entitlement.slug` | Registered capability slug; must equal `audience` |
| `entitlement.installedAt` | Installation timestamp |
| `issuedAt` | Absolute issue time |
| `expiresAt` | Absolute expiry, short-lived (on the order of seconds, not minutes) |
| `nonce` | Single-use identifier |

## Verification

A capability must reject a launch ticket unless all of the following hold:

- signature verifies against the issuing Merchant Portal deployment's current public key
- `audience` matches this capability's own slug
- `entitlement.slug` matches `audience`
- `applicationOrigin` matches the capability manifest and actual request origin
- `environment` matches which environment this capability instance is running in
- `expiresAt` has not passed
- `nonce` has not been seen before (replay protection — the capability must track consumed nonces for at least the ticket's maximum lifetime)

A ticket that fails any check is rejected outright. There is no partial trust and no fallback authentication path.

## What a ticket does not do

- It does not provision a user inside the capability. `initiatedBy` is an audit field, not a create-user instruction.
- It does not carry an HQ session or grant HQ authority to the capability. Any HQ-managed action is authorized by Merchant Portal before ticket issuance.
- It does not establish a shared cookie or shared session with Portal. Once the capability accepts the ticket, it creates its own session, entirely separate from Portal's. See [`../decisions/0004-no-shared-cookies.md`](../decisions/0004-no-shared-cookies.md).
- It is not reusable. One ticket authorizes the creation of exactly one capability session. A second launch, even seconds later, requires a fresh ticket.

## Claims, not interpretation

Every capability receives the same claims described above. There are no
per-capability claim templates. The capability decides how to use verified
merchant context after session creation; Portal does not prescribe its internal
roles or product behavior.

## Public key discovery

Each Merchant Portal deployment publishes its own current public key at a stable, versioned endpoint. Capabilities cache it but must be able to pick up a rotated key without a code change or redeploy — key rotation is an operational event, not a release.
