# OnePOS — Architecture Documentation

This folder is the living design record for OnePOS, a point-of-sale system for a hardware/retail
business. It was produced by researching current (2025-2026) best practices across packaging,
offline-sync, backend/RBAC, printer integration, and POS domain modeling, then synthesizing the
findings into one architecture.

## Scope decided with the business owner

- **Tenancy**: single business per deployment (not multi-tenant SaaS). Config is per-install
  (DB connection, branding), not a tenant table.
- **Terminals**: must keep working through a network/server outage (offline-first, sync later).
- **Delivery target**: web app (Next.js) that also packages into an installable Windows `.exe`.
- **Scale**: small/medium hardware retail business, not cloud-scale — architecture favors low
  operational maintenance over horizontal scalability.

## Guiding decisions

| Decision | Choice | Why |
|---|---|---|
| Tenancy | Single business per deployment | Matches requirement; config-file based branding/DB, not a tenant table |
| Terminal connectivity | Offline-first, sync later | A power/wifi blip can't stop a sale |
| Desktop packaging | **Electron** (not Tauri, not Nextron) | Nextron is unmaintained ("looking for maintainers" on GitHub); Tauri forces Rust onto a Node team for no POS-specific benefit; Electron has the most proven auto-update/code-signing/installer tooling for unattended retail PCs |
| Monorepo tool | **Turborepo** (not Nx) | Nx's project-graph/codegen power is wasted at 2-app scale; revisit only if the backend splits into many services |
| Authorization | **CASL**, rules persisted in MongoDB | Granular, data-driven permissions — a new permission is a new DB row, not new code |
| Offline sync backing store | Local **SQLite** in Electron (not IndexedDB, not local Mongo) | Relational queries on-device, tiny footprint, no browser-sandbox limits |
| MongoDB Realm / Atlas Device Sync | **Ruled out — confirmed dead** | MongoDB deprecated it Sept 2024; the sync service shut down Sept 30, 2025. Do not build on it. |
| Printing | Local **print-agent** inside the Electron main process | Keeps hardware I/O off both the web frontend and the API server; config is per-machine, not per-user |

## Documents in this folder

1. [`01-architecture-overview.md`](./01-architecture-overview.md) — system topology, monorepo layout, tech stack rationale
2. [`02-data-model.md`](./02-data-model.md) — MongoDB collections for the hardware-retail domain
3. [`03-rbac-permissions.md`](./03-rbac-permissions.md) — roles, CASL-based authorization, audit logging
4. [`04-configuration.md`](./04-configuration.md) — env vars vs DB-backed settings, branding/DB/printer config strategy
5. [`05-offline-sync-and-backup.md`](./05-offline-sync-and-backup.md) — offline-first terminal design, conflict handling, backup/DR
6. [`06-printer-integration.md`](./06-printer-integration.md) — receipt, label, and A4 invoice printing architecture
7. [`07-admin-dashboards-ux.md`](./07-admin-dashboards-ux.md) — admin features, reporting dashboards, cashier UX principles
8. [`08-roadmap.md`](./08-roadmap.md) — phased delivery plan
9. [`09-implementation-status.md`](./09-implementation-status.md) — what's actually built vs. planned, gotchas, how to run it locally

## Non-negotiable engineering rules

These came out of the QA/domain research as the most common ways POS systems fail in production —
treat them as constraints on every phase, not suggestions:

- **Money is integer cents or `Decimal128`, never floating point**, anywhere in the codebase.
- **Stock decrements are atomic** (`findOneAndUpdate` with a quantity guard), never read-then-write.
- **Every sale carries a client-generated idempotency key** so an offline-sync retry can't create
  a duplicate transaction.
- **Sale line items snapshot price/tax/UOM at time of sale** — never live-reference the product
  document, or historical reports/receipts drift when prices change later.
- **A printing failure must never block a sale from completing.** The sale commits to the database
  first; printing is decoupled and retryable.
- Negative stock has an **explicit policy** (block / warn / allow-backorder) — not an accident of
  missing validation.
