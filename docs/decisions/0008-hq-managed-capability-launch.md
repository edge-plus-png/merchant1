# 0008 — HQ-Managed Capability Launch Preserves the Merchant Boundary

## Decision

An HQ-managed session does not launch an application directly. It requests the action from the target Merchant Portal. Merchant Portal first authorizes the request against the merchant's installed `MerchantApplication` and the HQ-managed session's access mode. It does not create or require `PortalCapabilityAccess` for the HQ operator, because that record grants application access only to merchant Portal users. Only then does Merchant Portal use the signed application launch mechanism.

The application launch ticket contains the target merchant context and an opaque value in `initiatedBy`. For `EDGE_FULL_ACCESS` it identifies only the access mode, not the HQ operator, session identifier, or merchant membership. It is not an HQ account, merchant account, or instruction to provision an application user.

The HQ merchant-access ticket, HQ cookie, HQ-managed session identifier, and HQ authorization claims are never sent to the capability. The capability creates and owns its normal, separate capability session.

## Why

Merchant Portal remains the authority for merchant application installation and launch. This preserves the application contract and keeps applications independent of HQ membership and merchant-access ticket verification without representing the HQ operator as the merchant Owner or as an application user.

## Alternatives rejected

- **HQ issues application launch tickets directly** — rejected because it bypasses Merchant Portal's installation and access-mode checks and couples applications to HQ authorization.
- **Provision the HQ operator as a merchant or capability user** — rejected because it turns temporary managed access into persistent membership and misstates the operator's identity.
- **Forward the HQ merchant-access ticket to a capability** — rejected because the ticket has a different audience and trust boundary and must be consumed only by the target Merchant Portal.

## Consequences

The application does not receive an HQ operator identity, merchant membership, or merchant-local action log. HQ's own ticket-issuance record remains the only Edge-access evidence.
