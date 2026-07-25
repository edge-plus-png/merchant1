# GetEdgePortal

Sprint 1 implements only the HQ-to-Merchant Portal entry proof. HQ and Merchant
Portal remain separate products with separate identities, sessions, cookies, and
databases. The signed handover creates a temporary `SUPPORT_READ_ONLY` HQ-managed
session and never creates a merchant user or membership for the HQ operator.

## Sprint 1 routes

HQ:

- `/setup`
- `/login`
- `/dashboard`
- `/merchants`
- `/merchants/new`

Merchant Portal:

- `/dashboard` through the signed HQ handover

## Local proof

Use Node 24.x, install dependencies, then start the deterministic demo store:

```sh
PORTAL_DEMO_MODE=true npm run dev -- --hostname 127.0.0.1 --port 3100
```

Open `http://hq.localhost:3100/setup`. The first setup creates the Edge HQ and
master account; there are no seeded login credentials. Merchant slugs are exposed
locally as `http://{slug}.localhost:3100` so the browser exercises distinct HQ and
merchant cookie scopes.

For a PostgreSQL-backed environment, copy `.env.example` to `.env`, configure the
HQ or Merchant Portal surface and signing keys, then run:

```sh
npm run prisma:migrate
npm run prisma:seed
```

The HQ seed intentionally creates no master account. A merchant seed creates only
the local business record required to receive an HQ handover.

## Verification

With `DATABASE_URL` configured:

```sh
npm run verify
CI=1 npm run test:e2e
```

The end-to-end test starts from an empty HQ, creates the master account, logs in,
creates a `PROVISIONING` directory record, proves it cannot be opened, changes it
to `READY`, then exchanges the signed one-use ticket and confirms its Portal opens
with a separate HQ-managed session. It changes the merchant back to `PROVISIONING`
and proves Open Portal is removed. Unit coverage verifies both audited transitions.

Merchant deployment automation is outside Sprint 1. The operator supplies the
Portal URL created through the manual merchant checklist. No filesystem, Git,
Vercel, Neon, database or domain operation is performed by the HQ flow.
