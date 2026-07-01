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
before Phase 4).

## Phase 3 — Multi-terminal + shifts
Till/shift open-close reconciliation; concurrency-safe atomic stock updates
(`findOneAndUpdate` with quantity guard); multiple payment methods and split payments.

## Phase 4 — Offline-first
Electron shell wrapping Next.js + NestJS; local SQLite outbox for the offline sales queue;
background sync worker; server-side event replay with stockout/manager-review flagging.

## Phase 5 — Full printing
Print-agent module in the Electron main process: `node-thermal-printer` for receipts, a ZPL/EPL
template module for labels, Puppeteer for A4 invoices; per-machine `printers.json` config UI.

## Phase 6 — Admin & reporting
User/role management UI, branding/tax/printer settings UI, audit log viewer, supplier/PO/GRN
workflow, customer credit management, sales-summary dashboards (top sellers, low stock, margin,
shift variance, cashier performance).

## Phase 7 — Hardening & launch readiness
Backup/restore drill (actually test the restore, not just the backup); load test concurrent
terminals for stock race conditions; security review; Electron auto-update and code-signing;
UAT with real cashiers on the actual hardware being used in-store.

## Sequencing rationale

- Offline-first (Phase 4) comes *after* core POS and multi-terminal (Phases 2-3) rather than
  first, because the event-sourced sale model and idempotency keys it depends on are far cheaper
  to get right when there's already a working online single-terminal flow to build against, than
  to design blind.
- Printing (Phase 5) is deliberately built against a stable sale flow rather than in parallel
  with it, since "printing must never block a sale" (see [`README.md`](./README.md)) only makes
  sense to enforce once the sale-completion path already exists.
- Hardening (Phase 7) is last but is not optional polish — the backup/restore drill and
  concurrency load test are the two checks most likely to surface a design flaw that's expensive
  to fix after go-live.
