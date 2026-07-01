# Implementation Status

Living record of what's actually been built vs. what's still planned. Update this at the end of
each phase. See [`08-roadmap.md`](./08-roadmap.md) for the original phase plan this tracks against.

## Environment used for development

- MongoDB runs locally via Docker: `docker run -d --name onepos-mongo -p 27017:27017 -v onepos-mongo-data:/data/db mongo:7`
- `apps/api/.env` and `apps/web/.env.local` exist locally (gitignored) — copy from `.env.example`
  in each app if recreating the environment.
- Node 24, npm workspaces (no pnpm installed in this environment) — Turborepo works fine with npm
  workspaces, no functional loss vs. pnpm at this project's scale.

## Phase 1 — Foundation: DONE

### What's built

**Monorepo**: Turborepo + npm workspaces.
```
apps/web/      Next.js 16 — POS UI, admin panel, dashboards (only a placeholder home page so far)
apps/api/      NestJS 11 — REST API, auth, RBAC, business logic
apps/desktop/  Electron shell — placeholder only, real work starts Phase 4
packages/shared-types/    DTOs, enums, zod schemas — compiled to dist/, shared by web+api
packages/config/          shared tsconfig/eslint presets
packages/print-templates/ empty placeholder — real work starts Phase 5
```

**API modules implemented** (`apps/api/src/modules/`):
- `auth/` — `POST /api/auth/login` (email+password → JWT), `JwtStrategy`, `JwtAuthGuard`
- `users/` — User schema (bcrypt password + PIN hash), CRUD at `/api/users` (guarded)
- `roles/` — Role schema storing CASL rules as data, auto-seeds the 6 default roles
  (`roles.seed.ts`) on first boot against an empty collection
- `settings/` — Settings schema (singleton doc), in-memory cache, `/api/settings/public`
  (unauthenticated, for branding) and `/api/settings` (admin CRUD)

**Cross-cutting** (`apps/api/src/common/`):
- `casl/` — `CaslAbilityFactory` builds a CASL ability from a user's role rules;
  `CaslAbilityGuard` + `@CheckAbility()` decorator enforce it on routes; **both live in their own
  `CaslModule`**, imported by `UsersModule` and `SettingsModule` directly (not via `AuthModule`) —
  routing it through `AuthModule` caused a circular dependency (`AuthModule` already imports
  `UsersModule`).
- `pipes/zod-validation.pipe.ts` — generic `ZodValidationPipe<T>`, used on all mutating routes
- `types/` — `RequestUser` / `AuthenticatedRequest` (typed Express request augmentation, needed to
  satisfy the strict `@typescript-eslint/no-unsafe-*` rules Nest 11's default ESLint config enables)
- `config/env.validation.ts` — Zod-validated bootstrap env vars (`MONGODB_URI`, `JWT_SECRET`, etc.)

**Web**: minimal landing page (`apps/web/src/app/page.tsx`) that server-fetches
`/api/settings/public` — proves the web→API wiring end to end.

**CI**: `.github/workflows/ci.yml` — install/lint/typecheck/test/build on push/PR.

All of `npm run lint|typecheck|test|build` pass clean across all 6 workspaces.

### Gotchas hit during implementation (read before repeating this pattern)

1. **CASL circular dependency**: don't export `CaslAbilityFactory`/`CaslAbilityGuard` from
   `AuthModule`. Any module whose controllers use `@CheckAbility()` must import `CaslModule`
   directly (`apps/api/src/common/casl/casl.module.ts`).
2. **Internal TS packages must compile to `dist/`, not be consumed as raw `.ts` source.** This
   environment's Node 24 does native TypeScript execution (type-stripping only — no path
   rewriting), and NestJS's dev watcher ends up loading `@onepos/shared-types` as a
   synchronously-required ESM module, which enforces strict Node ESM resolution (real file
   extensions required). There is no clean way to make raw-`.ts`-as-source work across a
   Nest+Next.js monorepo on this Node version. `packages/shared-types` and
   `packages/print-templates` both have real `build` scripts (`tsc -p tsconfig.json` → `dist/`),
   and `turbo.json`'s `dev` task has `"dependsOn": ["^build"]` so `dist/` exists before `npm run
   dev` starts the apps. **If you edit a shared package while apps are running, re-run `npm run
   build` (or run that package's own `npm run dev` to watch-rebuild it).**
3. **Nest 11's default `eslint.config.mjs` enables `@typescript-eslint/no-unsafe-*` rules under
   strict type-checking.** Mongoose's `.id` virtual getter is untyped (`any`) — use `._id`
   (typed `Types.ObjectId`) instead, or type Express's `Request.user` explicitly rather than
   leaving it as `any`.
4. Ports 3000/3001 are the default web/api ports — if you get `EADDRINUSE` on restart, a stale
   `nest --watch` process is usually still running from a previous session; kill it before
   restarting rather than changing ports.

### How to run it locally

```bash
docker start onepos-mongo   # or `docker run -d --name onepos-mongo -p 27017:27017 -v onepos-mongo-data:/data/db mongo:7` if it doesn't exist
cd "D:/SELife/hardcore-projects/POS/OnePOS"
npm run build               # required once, builds packages/shared-types and packages/print-templates to dist/
cd apps/api && npm run start:dev   # terminal 1 — http://localhost:3001/api
cd apps/web && npm run dev         # terminal 2 — http://localhost:3000
```

## Phase 2 — Core POS, single terminal, online-only: NEXT

Per [`08-roadmap.md`](./08-roadmap.md), this phase is:

- Product / category / brand CRUD, with the `unitsOfMeasure[]` design from
  [`02-data-model.md`](./02-data-model.md) (piece vs. box vs. weight/length)
- `inventory` collection (per-branch `qtyOnHand`), stock increases via a `goodsReceivedNotes`
  (GRN) flow — **not** directly from purchase orders (POs and GRNs are deliberately decoupled)
- The sale flow itself: cart → line items (snapshotting price/tax/UOM, never live-referencing the
  product doc) → cash payment → completed sale, with **idempotency keys built in from day one**
  (cheaper now than retrofitting before Phase 4's offline sync depends on them)
- Receipt printing — simplest possible version for one terminal, full print-agent architecture
  is Phase 5
- Cashier-facing UI in `apps/web`: barcode-scanner-as-keyboard-input, `qty*sku` quick entry,
  running total/change-due display (see [`07-admin-dashboards-ux.md`](./07-admin-dashboards-ux.md)
  for the full UX spec — Phase 2 only needs to start applying it, not finish it)

Concrete first steps when resuming: add `products`, `categories`, `brands`, `inventory`,
`goodsReceivedNotes` schemas/modules to `apps/api` following the same module pattern as
`users`/`settings` (schema → service → controller → module, CASL-guarded), then build the `sales`
schema + a `POST /api/sales` endpoint that does the atomic stock decrement
(`findOneAndUpdate({_id, qty:{$gt:0}}, {$inc:{qty:-n}})` per
[`01-architecture-overview.md`](./01-architecture-overview.md)).

## Phase 3 — Multi-terminal, shifts, atomic stock: NOT STARTED

Till/shift open-close reconciliation, multiple payment methods and split payments. Atomic stock
decrement logic should already exist from Phase 2 — this phase is about proving it under real
multi-terminal concurrency and adding shift accounting on top.

## Phase 4 — Offline-first: NOT STARTED

Electron shell (currently just a placeholder in `apps/desktop`) wraps the Next.js+NestJS
processes for real; SQLite outbox; background sync worker; event-sourced sale replay. See
[`05-offline-sync-and-backup.md`](./05-offline-sync-and-backup.md).

## Phase 5 — Full printing: NOT STARTED

`node-thermal-printer` for receipts, ZPL/EPL template module for labels, Puppeteer for A4
invoices — all inside a print-agent in the Electron main process. See
[`06-printer-integration.md`](./06-printer-integration.md).

## Phase 6 — Admin & reporting: NOT STARTED

User/role management UI, branding/tax/printer settings UI, audit log viewer, supplier/PO/GRN
workflow UI, sales-summary dashboards. See [`07-admin-dashboards-ux.md`](./07-admin-dashboards-ux.md).

## Phase 7 — Hardening & launch readiness: NOT STARTED

Backup/restore drill, concurrency load test, security review, Electron auto-update/code-signing,
UAT with real cashiers.
