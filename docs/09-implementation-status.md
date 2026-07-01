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

## Phase 2 — Core POS, single terminal, online-only: DONE

### What's built (backend)

Six new API modules (`apps/api/src/modules/`), all following the `users`/`settings` schema →
service → controller (CASL-guarded) → module pattern, plus matching Zod DTOs in
`@onepos/shared-types`:

- `categories/`, `brands/` — plain CRUD. No `taxClasses`/`suppliers` collections yet, so
  `category.taxClassId` was dropped (tax is the existing flat `settings.defaultTaxRatePercent` +
  product-level `isTaxable`) and `brand.supplierIds[]` is an unvalidated string array.
- `products/` — `unitsOfMeasure[]` per `02-data-model.md` (piece/box/kg/etc., each with its own
  `conversionFactor`, `costPrice`, `sellPrice`, `barcode`). Service enforces exactly one
  `isBaseUnit` entry and barcode uniqueness across products.
- `inventory/` — per-branch (`branchId` stubbed to `"main"` — no branch-management module yet)
  `qtyOnHand`/`avgCost`. Read-only controller; the only writers are the internal
  `incrementStock`/`decrementStockAtomic`/`reverseDecrement` service methods, called by
  GRN/Sales. `incrementStock` uses an aggregation-pipeline `findOneAndUpdate` so the qty bump and
  weighted-average cost recompute happen in one atomic document write.
- `goods-received-notes/` (GRN) — the stock-increasing event, `poId` unvalidated/optional per the
  decoupled-from-PO design.
- `sales/` — cash-only sale flow: resolves lines against `products`/`settings` first (no stock
  touched yet), validates `amountTendered`, *then* decrements stock per line via
  `decrementStockAtomic`, compensating (re-incrementing) any already-decremented lines if a later
  line fails. `idempotencyKey` is unique-indexed; a repeat `POST /sales` with the same key returns
  the original sale rather than reprocessing. `GET /sales/:id/receipt` returns a plain structured
  payload — no real printer integration (that's Phase 5).
- `common/counters/` — small `Counter` schema (`{_id, seq}`) for atomic sequential `orderNo`/
  `grnNumber` generation.

No Mongo transactions are used anywhere — the local dev Mongo is a standalone instance, and
`01-architecture-overview.md` already prescribes atomic guarded `findOneAndUpdate` over
multi-doc transactions on the sale hot path.

One small backend addition made during the UI pass: `publicSettingsSchema` (`packages/shared-
types/src/settings.ts`) now also exposes `defaultTaxRatePercent` — the cashier role has no `read
Settings` permission (see `roles.seed.ts`), so the POS screen has no other way to compute a live
tax-inclusive running total. Not sensitive; it's printed on every receipt anyway.

### What's built (frontend, `apps/web`)

Full cashier + admin UI, wired to the live API — no more placeholder page. Auth is a **BFF-proxy
pattern**: `POST /api/auth/login` (a Next.js Route Handler) calls NestJS, then stores the JWT in
an httpOnly `onepos_session` cookie; the JWT never reaches browser JS. Every Client Component data
call goes through a catch-all `app/api/proxy/[...path]/route.ts` Route Handler that attaches
`Authorization: Bearer <token>` server-side. `proxy.ts` (Next 16 renamed `middleware.ts` →
`proxy.ts`) does an *optimistic* cookie-presence redirect to `/login`; the API's own
`CaslAbilityGuard` remains the real authorization boundary.

- `(app)/pos` — the cashier screen: barcode-scanner-as-keyboard-input, `qty*sku` manual entry
  (`5*1234`), a click-to-add product grid fallback, per-line qty/discount editing, a live
  subtotal/tax/total that mirrors the server's exact per-line math (`lib/pos/cart.ts`), single
  cash-tender checkout (`F2`/`F4` shortcuts), and a printable receipt view (`window.print()`).
  `idempotencyKey` is generated once per checkout attempt and only rotated after a *successful*
  sale, so retrying a failed submit is safe by construction.
- `(app)/products`, `(app)/categories`, `(app)/brands` — full CRUD. The product form has dynamic
  `unitsOfMeasure` rows (exactly-one-base-unit enforced client-side to match the server rule) and
  converts dollars↔cents at the form boundary only (`toMoneyCents`/`formatMoneyCents` from
  `@onepos/shared-types`) — the Zod resolver itself validates in dollars, not cents, since that's
  what a human types; see the "form schema" comment in `product-form-schema.ts` /
  `grn-form-schema.ts` for why this one field deliberately doesn't reuse the server's Zod schema
  verbatim.
- `(app)/inventory` — read-only stock table with a low-stock badge (`qtyOnHand <= reorderPoint`).
- `(app)/goods-received` — GRN list + create, with a UOM dropdown scoped to whichever product is
  selected on that line.
- `(app)/sales` — history list + receipt detail.
- Nav is filtered per role (`lib/permissions.ts`) mirroring `roles.seed.ts` — **cosmetic only**,
  not a security boundary; there's still no ability-resolution endpoint (see gotcha below), so a
  role→visible-nav-sections map is hand-maintained instead of derived from real CASL rules.
- **Deliberately not built** (matches what the backend actually supports): split/multi-payment
  tender, park/hold-sale, and manager-PIN-gated overrides — the sales API is single-cash-tender
  only with no draft/park state and no PIN-verify endpoint, so building any of these client-side
  would be UI theater with nothing enforcing it server-side. Real candidates for Phase 3.

### Gotchas hit during implementation (read before repeating this pattern)

1. **`@Prop({ type: Types.ObjectId, ... })` silently creates a `Mixed` schema path, not an
   ObjectId path** — `Types.ObjectId` (from `mongoose`'s top-level `Types`, the BSON value class)
   and `Schema.Types.ObjectId` (the schema-type marker Mongoose's compiler recognizes) are two
   different things, despite looking interchangeable in a lot of tutorials. With the wrong one,
   Mongoose stops casting query filters for that field — `Model.findOne({ someRef: aPlainString })`
   silently returns `null` even when a matching document exists with that value stored as a real
   ObjectId. This was already latent in Phase 1's `user.schema.ts` (`roleId`) — it "worked" there
   purely because `.populate()` matches via string comparison after querying the referenced
   collection by its own real `_id`, which masked the bug. Discovered when `GET
   /inventory/:productId` returned an empty body despite the document existing. **Fixed across all
   ObjectId ref props** (`users`, `categories`, `products`, `inventory`, `goods-received-notes`,
   `sales`): import `{ Schema as MongooseSchema } from 'mongoose'` and use
   `type: MongooseSchema.Types.ObjectId` in every `@Prop()` that references another collection.
   Keep using `Types.ObjectId` only for the TS property type annotation and for constructing actual
   ObjectId values (e.g. inside aggregation-pipeline update stages, which Mongoose never casts).
2. Running `npm run start:dev` again without killing the previous one leaves multiple `nest
   start --watch` processes fighting over port 3001 (`EADDRINUSE` on the loser, but the winner
   keeps serving — easy to mistake for "it's fine"). Check `netstat -ano | findstr :3001` /
   `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` and kill stray ones before
   restarting, per gotcha #4 above.
3. **Every read endpoint returns a raw Mongoose document, not the `*Dto` shape declared in
   `@onepos/shared-types`.** No controller/service maps `_id` → `id` (no `toJSON` virtuals, no DTO
   mapping layer) — the actual wire format is always `{_id, ...fields, __v}`. The `ProductDto` /
   `CategoryDto` / `BrandDto` / `InventoryDto` / `GrnDto` / `SaleDto` interfaces are correct for
   *request* bodies but not for what you get back from a `GET`. The frontend handles this with a
   `MongoDoc<T>` type alias (`apps/web/src/lib/api/types.ts`, `Omit<T, "id"> & {_id: string}`) —
   reuse that pattern rather than trusting `.id` on any list/detail response.
4. **No `GET /api/roles` and no ability-resolution endpoint** (e.g. `GET /auth/me` returning
   resolved CASL rules) — `roles.seed.ts`'s own comments say permissions should be admin-editable
   data, but nothing exposes them yet, on either the read or write side. Not a blocker for Phase 2
   (user/role management is Phase 6), but whoever builds Phase 6's role-management UI will need
   both a `roles` CRUD controller and, ideally, a way for the frontend to know a user's actual
   resolved abilities instead of the hand-maintained `roleName` → nav-sections map in
   `apps/web/src/lib/permissions.ts`.
5. **A running `apps/api` dev process caches `@onepos/shared-types` at process start** — editing a
   shared package and rerunning `npm run build` there is not enough; any *already-running*
   `nest start --watch` process has the old `dist/` loaded in its module cache and needs a full
   restart (not just a file-triggered recompile) to pick up the change. Hit this adding
   `defaultTaxRatePercent` to `publicSettingsSchema`.

### How to exercise Phase 2 locally

No user-registration endpoint exists yet (Phase 1 gap — `POST /users` is itself CASL-guarded), so
bootstrapping the first login still means inserting a user document directly against a seeded
role's `_id` (bcrypt-hash the password with the `bcrypt` package already in `apps/api`).

Easiest path is now the browser: `docker start onepos-mongo`, `npm run build` (root), then
`apps/api && npm run start:dev` / `apps/web && npm run dev`, open `http://localhost:3000`, log in,
and use the nav (Products → Categories/Brands → Goods Received → POS). To exercise the raw API
directly instead: `POST /categories`, `POST /brands`, `POST /products` (with 2+ `unitsOfMeasure`),
`POST /goods-received-notes` to receive stock, then `POST /sales` with a cash payment and an
`idempotencyKey`, and `GET /sales/:id/receipt`.

## Phase 3 — Multi-terminal, shifts, atomic stock: DONE

### What's built (backend)

- `common/manager-pin/` — `ManagerPinService.verifyAndGetApprover(pin)`, matches any
  manager/admin/super_admin-tier user with a `pinHash` set (bcrypt-compares against
  `UsersService.findManagerPinCandidates()`). No separate "verify PIN" pre-flight endpoint —
  the PIN travels inline with the mutating request it authorizes (discount override, void,
  cash-drawer paid-out/drop) and is verified atomically as part of that single call.
- `modules/shifts/` — new module, GRN-module-shaped (`shiftNo` via
  `CounterService.getNextSequence('shifts')`, own `cashDrawerMovements` collection). Endpoints:
  `POST /shifts/open`, `POST /shifts/:id/close` (computes `expectedCash`/`variance` from the
  shift's cash sales + cash-drawer movements), `GET /shifts/current` (own open shift for a
  terminal, or `null`), `GET /shifts`, `GET /shifts/:id`, `POST /shifts/:id/cash-movements`
  (manager PIN required for `paid-out`/`drop`, not `paid-in`), `GET /shifts/:id/cash-movements`.
  `ShiftsModule` and `SalesModule` each register the other's Mongoose schema directly via
  `forFeature` rather than importing the owning module, to avoid a real circular dependency
  (same reasoning as the Phase 1 CASL circular-dependency fix) — Shifts needs to sum cash sales
  for close-out, Sales needs to validate the shift is open before allowing a sale.
- `modules/sales/` — a shift is now **required** to sell (`shiftId` on `CreateSaleDto`, was
  optional in Phase 2); the single `amountTendered`/`changeGiven` payment is replaced by
  `payments: PaymentLineDto[]` (cash/card/mobile/credit, each with an amount and optional
  reference) — non-cash tender can't exceed the total, cash covers the remainder, change is
  always given from the cash portion. New: `POST /sales/park` (snapshots lines, no stock/
  payment side effects, `status:'parked'`), `GET /sales/parked`, `DELETE /sales/parked/:id`
  (own or manager-tier, only while still parked), `POST /sales/:id/void` (manager-PIN gated,
  reverses stock via the existing `reverseDecrement` compensating path, only on
  `status:'completed'` sales). Per-line discounts over `settings.maxCashierDiscountPercent`
  (default 20%) require a manager PIN unless the requesting user's own role already has
  `APPROVE Sale` (Manager/Admin/Super Admin self-approve).
- `roles.seed.ts` — Cashier gained `READ` on their own `Shift` and `DELETE` on their own
  (parked-only) `Sale`. Void/override/cash-movement routes carry only a cheap base
  `@CheckAbility` check (e.g. `CREATE Sale`) as defense-in-depth — the manager PIN is the real
  step-up authorization, not the calling user's CASL role.
- **No new generic `auditLogs` collection/interceptor** — that's Phase 6 ("audit log viewer").
  Void/override provenance lives directly on the `Sale` document (`voidedBy`, `voidReason`,
  `overrideApprovedBy`); a deliberate scope call, not an oversight.
- **Concurrency proof**: `modules/inventory/inventory.concurrency.spec.ts` — a real in-memory
  MongoDB (`mongodb-memory-server`, new devDependency) backs 20 concurrent
  `decrementStockAtomic(...,'block')` calls against 10 units of stock; asserts exactly 10
  succeed / 10 reject with `ConflictException`, and final `qtyOnHand` is never negative. Proves
  the Phase 2 atomic-`findOneAndUpdate`-with-guard mechanism under genuine concurrency, without
  changing the mechanism itself.

### What's built (frontend)

- POS is now shift-gated: no open shift → an "Open shift" form (opening float) renders instead
  of the cart. A header button closes the shift, showing the server-computed
  `expectedCash`/`variance`.
- Checkout (`checkout-dialog.tsx`) is a repeatable tender-row list (method/amount/reference,
  `useFieldArray` — same pattern as the product form's `unitsOfMeasure` rows) with a live
  remaining-balance display, instead of one `amountTendered` field. An **optimistic-submit,
  reactive-PIN-prompt** pattern handles discount overrides: the client doesn't know the
  discount threshold, it just submits normally and shows a manager-PIN modal only if the
  server rejects with an approval-required error, then retries with the PIN attached (same
  `idempotencyKey` — safe by the same construction as any other retry).
- `components/manager-pin-dialog.tsx` — one reusable PIN(+reason) modal, used for checkout
  overrides, void-sale, and paid-out/drop cash movements.
- Park-sale: `F6` parks the current cart; a "Parked sales" list (reached via a POS header
  button, no nav entry) supports Resume (reloads the snapshotted lines back into the cart via
  `?resume=<id>`, then deletes the parked record client-side once the real sale succeeds) and
  Discard.
- New `(app)/shifts` route: history table (own for Cashier, all for Manager/Admin/Super Admin)
  and a detail page with the cash-drawer-movement ledger and a record-movement form.
- `lib/terminal.ts` now persists a random id in `localStorage` per browser (was a hardcoded
  `"web-terminal-1"` constant), so separate browser windows genuinely act as distinct
  terminals.

### Gotchas hit during implementation (read before repeating this pattern)

See `docs/dev-playbook/phase3.txt` for the full list, including two real bugs found only by
manually testing in a browser (not caught by build/lint/typecheck/test):

1. Logging out never cleared the React Query cache, and no query in this app is keyed by user
   id — switching users in the same browser tab could silently reuse the previous session's
   cached "current shift", bypassing the open-shift gate entirely. Fixed with
   `queryClient.clear()` in the logout handler.
2. `ShiftDto` declared an `openedAt` field that no backend code ever populated (the schema
   deliberately reuses `createdAt` from `timestamps: true` instead of storing a redundant
   field) — same "raw Mongoose document, not the declared DTO shape" gap already documented in
   Phase 2. Fixed by having `ShiftDto` declare `createdAt` directly instead.
3. Roles only seed once against an empty collection (documented since Phase 1) — this phase's
   new Cashier CASL rules require dropping `db.roles` and restarting the API on any dev DB
   seeded before this phase, which in turn orphans existing users' `roleId` (roles get new
   `_id`s on reseed) until repaired by matching on role `name`.

### How to exercise Phase 3 locally

See `docs/dev-playbook/phase3.txt` for the full walkthrough, test users, and how to set a
manager PIN (neither seeded user has one by default, needed to fully exercise discount
override / void / paid-out-cash-movement).

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
