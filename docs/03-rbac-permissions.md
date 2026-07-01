# RBAC, Permissions & Audit Logging

## Authorization library: CASL

CASL is the dominant, actively maintained authorization library for Node/NestJS in 2025-2026,
purpose-built for this problem: incremental adoption from simple RBAC up to attribute-based
rules, without rewriting guards later.

Alternatives considered and rejected:

- **Custom Guards + Decorators only** — fine initially, but every new granular permission
  (e.g. "Cashier can void own sales but not others'") becomes a new decorator/guard combination.
  Doesn't scale past roughly 10-15 permissions.
- **NestJS's official `@Roles()` + `RolesGuard` recipe** — a starting pattern, not a full
  solution. Coarse-grained (role-only, no resource/action granularity).

## How it works

CASL models permissions as `(action, subject, conditions, fields)` — e.g.
`can('read', 'Report')` for an Auditor, or `can('update', 'Sale', { cashierId: user.id })` for a
Cashier (can only edit their own sale).

- Ability rules are stored per role (or per user override) in a `roles`/`permissions` collection
  in MongoDB.
- The `Ability` is built in a factory from JWT claims on each request.
- Enforcement is a single `CaslAbilityGuard` + `@CheckAbility()` decorator applied to routes.
- **New permissions are data (new rule entries), not code.** This matters because the boundary
  between Manager and Cashier, or what an Accountant can see, will keep shifting after launch —
  Super Admin should be able to tune this from the UI without a deploy.

## Default roles (seed data, not hardcoded)

- **Super Admin** — full access, including settings, DB connection, user/role management
- **Admin** — full operational access, no infrastructure-level settings
- **Manager** — approves overrides/voids/discounts, views all reports, manages shifts
- **Cashier** — sale flow, own-shift till operations, cannot override prices without manager PIN
- **Inventory Clerk** — products, stock, purchase orders, GRNs — no sales/financial access
- **Accountant / Auditor** — read-only across sales/financial reports, no operational writes

Keep a thin default-role seed, but make permissions data-driven so new granular rules can be
added later without a code change.

## Audit logging

- Model an explicit `auditLogs` collection rather than relying only on generic HTTP logging
  middleware: `{ actorId, actorRole, action, subject, subjectId, before, after, ip, timestamp }`.
- Implement via a **global NestJS interceptor** on mutating routes (POST/PATCH/DELETE) that
  captures the before/after state and writes asynchronously (fire-and-forget or queued) so it
  never blocks the request path.
- For MongoDB specifically, capture the pre-image via a Mongoose `pre('findOneAndUpdate')` hook
  rather than trusting only the interceptor's request body — partial updates and schema defaults
  can obscure what actually changed.
- Keep audit writes in a separate collection/write path from operational data so retention and
  archival policy (e.g. a 1-year TTL index) can differ from live POS data.
- Always log security-sensitive actions explicitly and separately from generic CRUD — login,
  permission changes, settings changes, voids, refunds, price overrides. These are what an
  auditor or a fraud investigation will actually query for.

## Sources consulted

- Node.js Authorization Patterns: RBAC, ABAC & CASL Guide (2026)
- CASL — Roles with persisted permissions in NestJS (Medium/Yavar)
- Implementing Audit Logging in a NestJS Application (Cropsly)
- Building an Audit Trail System in NestJS (Medium)
