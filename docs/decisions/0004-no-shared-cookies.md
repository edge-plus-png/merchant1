# 0004 — No Shared Cookies

## Decision

Portal and every capability maintain entirely separate sessions. There is no shared cookie, shared session store, or shared login between Portal and any capability, or between two capabilities. A capability session is created fresh, by the capability itself, only after a valid signed launch ticket is presented.

## Why

A shared session would mean a capability's security depends on Portal's cookie handling (and vice versa), and a vulnerability or misconfiguration in one system's session layer becomes exploitable against every other system sharing it. It also directly implies a single-tenant-per-deployment boundary is worth preserving deliberately: each capability instance already serves multiple merchants (distinguished by launch ticket, not by deployment), so a shared session would be an easy way to leak one merchant's context into another's request.

## Alternatives rejected

- **Single sign-on via a shared session cookie scoped to `*.getedgeportal.app`** — rejected: couples every capability's session security to Portal's, and to every other capability's, and makes cross-merchant leakage a single-bug-away risk instead of a structurally prevented one.
- **Portal-issued JWT stored and reused by the capability as its ongoing session token** — rejected: this is functionally a long-lived shared credential, which reintroduces the standing-credential risk the launch ticket is deliberately designed to avoid (see [`0003-signed-launch-ticket.md`](0003-signed-launch-ticket.md)).

## Consequences

A capability cannot ask "is this user still logged into Portal" mid-session; it manages its own session lifetime independently once launched. Logging a user out of Portal does not, by itself, end their session inside an already-launched capability — if that matters for a given capability, the capability must apply its own reasonably short session expiry.
