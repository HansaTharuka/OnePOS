# Phased Delivery Roadmap

Each phase is also tracked as a task in the active build session (the "progress dashboard"); this
file is the durable record of what each phase actually contains.

## Phase 1 — Foundation
Turborepo scaffold (`apps/web`, `apps/api`, `apps/desktop`, `packages/shared-types`); NestJS +
MongoDB + auth skeleton; CASL RBAC skeleton with a `roles`/`permissions` collection; settings
service (hybrid env + DB config); base CI pipeline.

## Phase 2 — Core POS (single terminal, online-only)
Product/category/brand/inventory CRUD with multi-UOM support; sale flow with cash payment;
receipt printing; idempotency keys on sales from day one (cheaper to build in than retrofit
before offline-first arrives).

## Phase 3 — Multi-terminal + shifts
Till/shift open-close reconciliation; concurrency-safe atomic stock updates
(`findOneAndUpdate` with quantity guard); multiple payment methods and split payments.

## Phase 4 — Centralized deployment (browser terminals)
Ship the primary deployment topology: MongoDB + `apps/api` + `apps/web` running together on one
central server (`docker-compose.yml`, `apps/api/Dockerfile`, `apps/web/Dockerfile`), reachable
over LAN by any number of plain-browser terminals — no per-terminal install or update. Includes
the deployment-mode fixes this shape needed: `COOKIE_SECURE` decoupled from `NODE_ENV` (a no-TLS
LAN deployment must not set the session cookie's `secure` flag), and consolidating the API base
URL into one shared helper. See [`04-configuration.md`](./04-configuration.md).

## Phase 5 — Full printing
Print-agent module: `node-thermal-printer` for receipts, a ZPL/EPL template module for labels,
Puppeteer for A4 invoices. Runs as a small standalone local service per terminal machine (per
[`06-printer-integration.md`](./06-printer-integration.md) §4) — the same agent core works whether
the terminal is a plain browser (Phase 4's primary path) or the Electron shell (Phase 7); browsers
can't drive printer hardware directly, so this local agent is required either way. Per-machine
`printers.json` config UI.

## Phase 6 — Admin & reporting
User/role management UI, branding/tax/printer settings UI, audit log viewer, supplier/PO/GRN
workflow, customer credit management, sales-summary dashboards (top sellers, low stock, margin,
shift variance, cashier performance).

## Phase 7 — Offline-first (Electron)
The secondary deployment path, for sites that need a terminal to keep selling through a
network/server outage: Electron shell wrapping the Next.js UI, a local SQLite outbox for the
offline sales queue, a background sync worker, and server-side event replay with
stockout/manager-review flagging.

This is **rework**, not new-from-scratch: the outbox, sync worker, and server-side replay
(`modules/sync/`) already exist from an earlier build pass, and the wire contract
(`packages/shared-types/src/sync.ts`) is already topology-agnostic. What needs to change is the
Electron main process itself (`apps/desktop/src/main.ts`) — today it spawns its own local
`apps/api` and an embedded MongoDB (`mongo-manager.ts`) per machine, a single-machine demo
shortcut; it needs to instead point at the real central server built in Phase 4 (configurable
host, not hardcoded `localhost`), consistent with the topology
[`01-architecture-overview.md`](./01-architecture-overview.md) describes. Also add a real
`GET /sync/pull` catalog delta-sync (today it's a clock-heartbeat only) so a terminal that was
offline while products/prices changed elsewhere can reconcile before it reconnects.

## Phase 8 — Hardening & launch readiness
Backup/restore drill (actually test the restore, not just the backup); load test concurrent
terminals for stock race conditions; security review; Electron auto-update and code-signing;
UAT with real cashiers on the actual hardware being used in-store. Runs once, after both
deployment paths (Phase 4 and Phase 7) exist, so it covers the complete system rather than
needing a second pass later.

## Sequencing rationale

- Centralized browser deployment (Phase 4) comes before offline-first (Phase 7) rather than after,
  because it's the simpler, cheaper-to-operate shape to ship and validate first — one server to
  patch/back up instead of N Electron installs each with their own embedded database — and because
  building it first gives the offline rework a real central server to sync against instead of
  designing it blind against a single-machine stand-in (which is what happened the first time
  around).
- Multi-terminal and shifts (Phase 3) still comes before centralized deployment (Phase 4) rather
  than after, because the event-sourced sale model, idempotency keys, and per-terminal identity it
  depends on are far cheaper to get right against a working single-terminal flow than to design
  blind — the same reasoning that originally motivated offline-first coming after core POS.
- Printing (Phase 5) is deliberately built against a stable sale flow rather than in parallel with
  it, since "printing must never block a sale" (see [`README.md`](./README.md)) only makes sense to
  enforce once the sale-completion path already exists. It's sequenced after Phase 4 (rather than
  immediately after Phase 3) because its browser-terminal print-agent variant is easiest to build
  once browser terminals are the thing actually running in Phase 4.
- Offline-first (Phase 7) is deliberately last among the feature phases — it's the secondary path,
  needed only by sites that require in-store resilience to a network/server outage, and reworking
  it against a real central server (built in Phase 4) rather than blind is cheaper than doing it
  first.
- Hardening (Phase 8) is last but is not optional polish — the backup/restore drill and
  concurrency load test are the two checks most likely to surface a design flaw that's expensive
  to fix after go-live, and running it once against the complete system (both deployment paths)
  avoids re-doing it after Phase 7 lands.
