# Signed Launch Ticket

This is the single SSO mechanism used by every first-party capability — Move, Events, Storefront, and any future capability. It replaces Events' existing shared-secret launch approach entirely; no capability keeps its own bespoke launch scheme. See [`../decisions/0003-signed-launch-ticket.md`](../decisions/0003-signed-launch-ticket.md).

## Mechanism

Asymmetric signing. Each Merchant Portal deployment holds its own signing private key directly and signs its own launch tickets — there is no separate signing service today (see [`../platform/portal-architecture.md`](../platform/portal-architecture.md), "Where platform data lives," for why this is deliberately simple for now). When an authorized Merchant Portal principal requests a launch, that merchant's own Portal deployment signs the ticket itself, using its own key, and sends it directly to the capability. The principal is normally a merchant user, but may be a merchant-local HQ-managed session when its access mode permits the action. Capabilities never hold the private key — they fetch the issuing Merchant Portal deployment's current public key (via the reference published in the capability's own `.well-known/getedge-capability.json`, see [`capability-starter.md`](capability-starter.md)) and use it only to verify signatures. A capability that can verify a ticket cannot forge one.

If, once several capabilities are all consuming structurally identical tickets from several Merchant Portal deployments, signing and verification becomes real duplicated work worth extracting, a shared issuer can be introduced later as an implementation change — the ticket shape and verification rules below don't need to move for that to happen.

## Ticket shape

| Field | Meaning |
|---|---|
| `issuer` | Fixed identifier for the issuing Merchant Portal deployment |
| `audience` | The capability slug this ticket is valid for (e.g. `move`) — a ticket issued for one capability must be rejected by any other |
| `merchantId` | The merchant this session is for |
| `merchantName` | Display name, for the capability's own UI — not authoritative, the capability should treat `merchantId` as the source of truth |
| `environment` | `staging` or `production` — a ticket issued for one must be rejected by a capability instance running in the other |
| `initiatedBy` | Opaque Merchant Portal audit reference for the principal that requested launch. For an HQ-managed session this is the merchant-local HQ-session audit identifier, not an HQ application user identity. |
| `expiresAt` | Absolute expiry, short-lived (on the order of seconds, not minutes) |
| `nonce` | Single-use identifier |

## Verification

A capability must reject a launch ticket unless all of the following hold:

- signature verifies against the issuing Merchant Portal deployment's current public key
- `audience` matches this capability's own slug
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

Merchant Portal defines which claims it sends on the ticket — `merchantId`, `initiatedBy`, `environment`, and any others a given capability's launch actually requires. It does not, and must not, define what those claims mean inside the capability. A capability may treat `initiatedBy` as an audit string it never looks at again, or may map it to an internal role, or may ignore it entirely once its own session is created — that decision belongs to the capability, not to this document. Merchant Portal's contract ends at "here is a verified claim"; what the capability does with it is outside the contract.

## Public key discovery

Each Merchant Portal deployment publishes its own current public key at a stable, versioned endpoint. Capabilities cache it but must be able to pick up a rotated key without a code change or redeploy — key rotation is an operational event, not a release.
