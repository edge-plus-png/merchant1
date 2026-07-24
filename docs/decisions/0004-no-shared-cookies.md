# 0004 — No Shared Cookies

## Decision

HQ, every Merchant Portal, and every capability maintain entirely separate sessions. There is no shared cookie, shared session store, or shared login between HQ and Merchant Portal, between Merchant Portal and a capability, or between two capabilities. Merchant Portal creates a fresh HQ-managed session only after accepting an HQ merchant-access ticket. A capability creates a fresh capability session only after accepting its separate capability launch ticket.

## Why

A shared session would mean a capability's security depends on Portal's cookie handling (and vice versa), and a vulnerability or misconfiguration in one system's session layer becomes exploitable against every other system sharing it. It also directly implies a single-tenant-per-deployment boundary is worth preserving deliberately: each capability instance already serves multiple merchants (distinguished by launch ticket, not by deployment), so a shared session would be an easy way to leak one merchant's context into another's request.

## Alternatives rejected

- **Single sign-on via a shared session cookie scoped to `*.getedgeportal.app`** — rejected: couples every capability's session security to Portal's, and to every other capability's, and makes cross-merchant leakage a single-bug-away risk instead of a structurally prevented one.
- **Portal-issued JWT stored and reused by the capability as its ongoing session token** — rejected: this is functionally a long-lived shared credential, which reintroduces the standing-credential risk the launch ticket is deliberately designed to avoid (see [`0003-signed-launch-ticket.md`](0003-signed-launch-ticket.md)).
- **Cookie scoped to `*.getedgeportal.app` for HQ-to-merchant access** — rejected: it would make an HQ credential ambient authority at every merchant domain and would erase the explicit, audited session-creation boundary.

## Consequences

A Merchant Portal cannot use an HQ cookie; it trusts only its own HQ-managed session after ticket exchange. A capability cannot ask "is this user still logged into Merchant Portal or HQ" mid-session; it manages its own session lifetime independently once launched. Logging out of either upstream product does not, by itself, end an already-launched capability session — if that matters for a given capability, the capability must apply its own reasonably short session expiry.
