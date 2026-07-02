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

## Phase 4 — Centralized deployment (browser terminals): DONE

Ships the primary deployment topology (see
[`01-architecture-overview.md`](./01-architecture-overview.md)): one central machine runs MongoDB
+ `apps/api` + `apps/web` together; terminals are plain browser tabs pointed at that machine's LAN
address, nothing installed per terminal. This phase was inserted ahead of the originally-numbered
Phase 4 ("Offline-first," below, now Phase 7 — see [`08-roadmap.md`](./08-roadmap.md)'s sequencing
rationale for why). See [`04-configuration.md`](./04-configuration.md) for the full operator
walkthrough.

### What's built

- `apps/web/src/lib/session.ts`: `setSessionCookie()`'s `secure` flag decoupled from `NODE_ENV`,
  now a dedicated `COOKIE_SECURE` env var (default `false`). Fixes a real bug for this deployment
  shape — a no-TLS shop-LAN deployment run with `NODE_ENV=production` would otherwise have
  `secure: true` silently make the browser discard the session cookie, bouncing every login back
  to `/login`.
- `apps/web/src/lib/api/base-url.ts`: new `getApiBaseUrl()` helper, single source of truth for the
  API base URL. Previously the same `"http://localhost:3001/api"` fallback literal was duplicated
  independently in six files (`api/auth/login/route.ts`, `api/auth/setup/route.ts`,
  `api/proxy/[...path]/route.ts`, `lib/api/server.ts`, `lib/setup-status.ts`, `lib/settings.ts`) —
  all six now import the shared helper instead, removing a real drift risk now that this value
  matters for actual deployments, not just local dev.
- `apps/api/Dockerfile`, `apps/web/Dockerfile`: multi-stage builds, repo root as build context
  (required for npm workspaces — `@onepos/shared-types` must be resolvable), each running
  `npx turbo run build --filter=<pkg>` after an `npm ci` deps stage. `apps/web`'s image relies on
  `next.config.ts`'s pre-existing `output: "standalone"` + `outputFileTracingRoot` (already set up
  for monorepo module resolution, not new this phase). Neither image is size-optimized (ships full
  `node_modules` including devDependencies) — acceptable at this project's scale, same rationale as
  the existing Turborepo-over-Nx call in `01-architecture-overview.md`.
- `docker-compose.yml` (repo root): three services — `mongo` (named volume), `api` (depends on
  mongo), `web` (depends on api, reaches it over the compose network at `http://api:3001/api`,
  never exposed to the browser — that fetch is server-side only, see `base-url.ts`'s callers).
  Root `.env.example` documents the two required vars (`JWT_SECRET`, `WEB_ORIGIN`).
- `.dockerignore` (repo root): keeps `node_modules`/`dist`/`.next`/etc. out of the build context.

### Gotchas hit during implementation (read before repeating this pattern)

1. **`NEXT_PUBLIC_*`-prefixed env vars get inlined at Next.js *build* time even in server-only
   code**, regardless of whether the surrounding module ever reaches the browser bundle. The API
   base URL was originally named `NEXT_PUBLIC_API_BASE_URL`, and every call site is server-only
   (Route Handlers / Server Components — see `base-url.ts`'s callers), but Next's bundler still
   performs the substitution via blind static analysis, not real client/server graph awareness.
   Caught by grepping the compiled `.next/server` output after a Docker build, where
   `getApiBaseUrl()` had been collapsed to an unconditional `return "http://localhost:3001/api"`
   — the var wasn't set during `docker build` (only later, at `docker compose up`, per
   `docker-compose.yml`), so the build baked in just the fallback literal, and setting the var at
   container-start had **no effect at all**. Concretely: the `web` container kept calling
   `localhost:3001` internally (nothing listens there in that container), `getSetupStatus()`'s
   catch-and-fail-closed swallowed the resulting fetch error, and `/login` never redirected to
   `/setup` on a fresh database — first-run setup was silently unreachable. Fixed by renaming the
   var to plain `API_BASE_URL` everywhere (`base-url.ts`, both `.env.example` files,
   `docker-compose.yml`, and `apps/desktop/src/main.ts`'s child-process spawn env, which had the
   identical latent bug — it just never surfaced there because dev builds happened to bake in the
   same `localhost:3001` value the single-machine demo topology also used at runtime, by
   coincidence). **Rule of thumb going forward**: never use the `NEXT_PUBLIC_` prefix for a var
   that isn't genuinely meant to reach client-side JS, even inside a file that happens to run
   server-side today.

### How to exercise Phase 4 locally

`npm run build|typecheck|lint` pass clean across every workspace with these changes. Verified live
in this environment (Docker is available here): `cp .env.example .env` (set `JWT_SECRET`), then
`docker compose up -d --build` brought up all three services; `GET /login` correctly 307-redirected
to `/setup` on the fresh database, `POST /api/auth/setup` created the admin and returned a
`Set-Cookie: onepos_session=...; HttpOnly; SameSite=lax` header **without** a `Secure` attribute
despite the container running with `NODE_ENV=production` (proves the `COOKIE_SECURE` fix works,
decoupled from `NODE_ENV`), and a follow-up authenticated request through `/api/proxy/settings`
using that cookie reached the real NestJS backend and returned the just-created settings document.
Not yet exercised: a genuine second physical/virtual machine on a LAN (this was one Docker host
acting as both "server" and "terminal" via `localhost`) — the only thing that changes for a real
second terminal is which IP `WEB_ORIGIN`/the browser use, already covered by
`04-configuration.md`'s walkthrough.

## Phase 5 — Full printing: NOT STARTED

`node-thermal-printer` for receipts, ZPL/EPL template module for labels, Puppeteer for A4
invoices — all inside a print-agent in the Electron main process. See
[`06-printer-integration.md`](./06-printer-integration.md).

## Phase 6 — Admin & reporting: NOT STARTED

User/role management UI, branding/tax/printer settings UI, audit log viewer, supplier/PO/GRN
workflow UI, sales-summary dashboards. See [`07-admin-dashboards-ux.md`](./07-admin-dashboards-ux.md).

## Phase 7 — Offline-first (Electron): DONE, topology rework pending

**This section is unmodified history** — see [`08-roadmap.md`](./08-roadmap.md) for why this work,
originally built and numbered as "Phase 4," now sits at Phase 7 in the roadmap, after the
centralized-deployment phase above. The single-machine topology described in the scope note right
below is exactly what's scheduled to be reworked when this phase comes up for real: the Electron
main process needs to stop spawning its own local `apps/api` + embedded MongoDB and instead point
at the central server built in Phase 4, per `01-architecture-overview.md`'s topology diagram.

A prior session had committed only the shared-types contract for this phase
(`SyncPushRequestDto`/`SyncPushResultDto`/`SyncEventDto`, `needsManagerReview`/`reviewReason` on
`SaleDto`) before crashing; everything below completes it. See
[`05-offline-sync-and-backup.md`](./05-offline-sync-and-backup.md) for the design this follows,
and `docs/dev-playbook/phase4.txt` for the full walkthrough and gotchas.

**Scope, deliberately**: single-machine dev/demo topology (one Electron install spawns both
`apps/web` and `apps/api` as local child processes — multi-terminal LAN deployment is a
documented env-var knob, not built); offline covers the sale-creation write path only, not
catalog reads (barcode scan/cart-build already worked offline via the existing React Query
cache — no delta-sync contract exists or was added for products/inventory); offline discount
overrides above the cashier cap are refused client-side before queuing rather than supported
(no server round-trip is possible offline to react to the "manager approval required"
rejection the online flow depends on). No `electron-builder` packaging — that's Phase 8.

### What's built (backend)

- `packages/shared-types/src/sync.ts`: added a `'failed'` status to
  `SYNC_EVENT_RESULT_STATUSES` (alongside the already-committed `'applied'/'duplicate'/'flagged'`)
  — a genuine business-rule rejection (e.g. a shift closed on another terminal before sync ran)
  can't be represented by the other three without misrepresenting it as success. Also added a
  shared `SyncStatus` interface, used by both `apps/desktop`'s sync worker and the web POS's
  pending-sync badge.
- `packages/shared-types/src/settings.ts`: `maxCashierDiscountPercent` added to
  `publicSettingsSchema` (same precedent as Phase 2's `defaultTaxRatePercent`) so the offline
  checkout path can advise the cashier client-side before queuing a sale that's guaranteed to
  fail replay.
- `modules/sales/schemas/sale.schema.ts`: added the `needsManagerReview`/`reviewReason` props
  that the crashed session had added to `SaleDto` but never to the actual Mongoose schema —
  they'd have silently never persisted.
- `modules/sales/sales.service.ts`: `create()` gained an optional 4th param
  `options?: { allowStockForceThrough?: boolean }`. When set and a `'block'`-policy
  `decrementStockAtomic` throws `ConflictException`, it retries with `'allow_backorder'`
  (already an unconditional `$inc`, no new inventory method needed) and marks the created sale
  `needsManagerReview`. Also added `findByIdempotencyKey()`, used by the sync module to
  distinguish "already applied" from "just created" before calling `create()`.
- New `modules/sync/` (module/service/controller, shaped like `shifts/`): `POST /sync/push`
  replays a batch of queued `SyncEventDto`s sequentially (not `Promise.all` — keeps per-product
  stock ordering deterministic, and reuses `SalesService.create()` unchanged for the actual
  business logic) and returns one `SyncPushResultDto` per event; `GET /sync/pull` returns
  `{serverTime}` — a clock-sync heartbeat only, no catalog delta sync. Both guarded the same way
  as every other controller (`JwtAuthGuard` + `CaslAbilityGuard`), reusing the existing `SALE`
  CASL subject rather than adding a new one.
- `modules/sync/sync.service.spec.ts`: real in-memory-MongoDB test (same pattern as
  `inventory.concurrency.spec.ts`) proving duplicate-idempotencyKey replay, forced-through
  stockout → `flagged` + negative `qtyOnHand`, and a shift mismatch → `failed` with no sale
  created.

### What's built (desktop, `apps/desktop`)

Replaces the Phase 1 placeholder `main.ts` entirely:

- `src/outbox.ts` — `better-sqlite3`-backed local write-ahead store (`outbox.sqlite3` in
  Electron's `userData` dir), one `outbox` table keyed by `client_event_id` (so a duplicate
  `enqueue()` is a no-op). `enqueue`/`listPending`/`markError`/`remove`/`countPending`/`countErrored`.
- `src/sync-worker.ts` — a 15s interval loop: health-checks `GET /api/settings/public`, and if
  reachable with pending rows, reads the `onepos_session` cookie straight out of the same
  Electron session the renderer's login already populated (BFF pattern, see gotcha below),
  `POST`s `/api/sync/push` directly against NestJS (bypassing the Next.js proxy — the main
  process isn't a browser page), and per-result either removes the row (`applied`/`duplicate`/
  `flagged`) or marks it `error` (`failed` — won't be retried, it'll fail identically forever).
  Broadcasts `SyncStatus` to the renderer after every tick.
- `src/preload.ts` — `contextBridge`-exposed `window.onepos = {queueSale, getSyncStatus,
  onSyncStatusChange}`, the only surface the renderer gets into the main process.
- `src/main.ts` — spawns `apps/api` (`node dist/main.js`) and `apps/web` (`npm run start`) as
  child processes, polls both for health, opens a `BrowserWindow` loading the web app, wires the
  `ipcMain` handlers, starts the sync worker, and kills both children on quit.
- `better-sqlite3` is a native module and needs `apps/desktop`'s own `npm run rebuild`
  (`electron-rebuild -f -w better-sqlite3`) run once manually — **deliberately not** an automatic
  `postinstall` (see gotcha below).

### What's built (web, `apps/web`)

- `lib/offline/electron-bridge.ts` — `isElectron()` guard, `Window.onepos` type declaration, and
  `isNetworkFailure(err)` (`err instanceof TypeError` — the native `fetch()` rejection shape,
  as opposed to `ApiError` which `apiFetch` throws for a resolved-but-not-`ok` response).
- `lib/offline/use-sync-status.ts` — subscribes to `window.onepos.onSyncStatusChange`; no-ops
  (`{online: true, pendingCount: 0, erroredCount: 0}`) outside Electron, safe to render
  unconditionally (the plain-browser-tab fallback path is unaffected).
- `(app)/pos/checkout-dialog.tsx` — `submitSale`'s catch path now checks
  `isNetworkFailure(error) && isElectron()` before falling through to the existing
  manager-approval-retry handling: if any line's discount exceeds the now-public
  `maxCashierDiscountPercent`, refuses to queue with a toast; otherwise calls
  `window.onepos.queueSale(...)` (same `idempotencyKey` as the DTO, so a later duplicate replay
  is a no-op) and calls the new `onQueuedOffline` prop instead of `onSuccess`.
- `(app)/pos/page.tsx` — `handleQueuedOffline` mirrors `handleSaleSuccess`'s cart-clear/parked-
  cleanup/idempotency-key-rotation but stays on `/pos` (no server sale id exists yet to navigate
  to) with a toast instead; a "N pending sync"/"N sync errors" badge renders next to the shift
  badge via `useSyncStatus()`.
- `(app)/sales/` list and detail pages: a "Needs review" badge (plus `reviewReason` text on the
  detail page) when `needsManagerReview` is true — otherwise a flagged sale would be completely
  invisible. No dedicated review/dismiss workflow — that's Phase 6 admin territory.

### Gotchas hit during implementation (read before repeating this pattern)

See `docs/dev-playbook/phase4.txt` for the full list, including:

1. Wiring `better-sqlite3`'s Electron-ABI rebuild as an automatic `postinstall` broke root
   `npm install` on any machine without a C++ build toolchain — including this repo's own dev
   sandbox. Moved to a manual `npm run rebuild` script in `apps/desktop` instead; a native
   dependency's build step should never gate the whole monorepo's install.
2. The Electron main process doesn't need a second auth flow — it reads the renderer's existing
   `onepos_session` httpOnly cookie (JSON-stringified `{accessToken, user}`, URL-encoded by the
   `cookie` package under the hood) straight out of `session.defaultSession.cookies`, since the
   `BrowserWindow` shares that Chromium session with the page that logged in.
3. `SalesService.create()`'s pre-existing idempotency dedup (return the existing doc if found)
   doesn't tell the caller whether it found-vs-created — the sync module needed a dedicated
   `findByIdempotencyKey()` check *before* calling `create()` to report `'duplicate'` accurately.

### How to exercise Phase 7 (Offline-first) locally

See `docs/dev-playbook/phase4.txt` for the full walkthrough (build, one-time `electron-rebuild`
step, and the offline/reconnect/stockout/discount-cap scenarios). Not independently verified in
this environment: the actual Electron window and live offline walkthrough — `better-sqlite3`
can't be rebuilt here (no C++ toolchain). Backend behavior is covered by
`sync.service.spec.ts`; `npm run build|typecheck|lint|test` all pass clean across every
workspace including `apps/desktop`.

## Phase 8 — Hardening & launch readiness: NOT STARTED

Backup/restore drill, concurrency load test, security review, Electron auto-update/code-signing,
UAT with real cashiers.
