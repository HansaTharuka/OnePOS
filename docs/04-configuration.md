# Configuration Strategy

Goal: "easily configurable" — DB connection, logo, business name, tax rules, printers — without
forcing a rebuild, and ideally without a restart for anything business-facing.

## Hybrid: bootstrap env vars + DB-backed settings

### Env vars (bootstrap-only, immutable at runtime)

Anything needed *before* Mongo connects: `MONGODB_URI`, `PORT`, `JWT_SECRET`, `NODE_ENV`. Use
`@nestjs/config` with Zod (or Joi) validation. This is the one category of config that does
require a restart to change — that's acceptable, since changing the DB connection is inherently
an infrastructure action, not a business one.

### `settings` collection (mutable at runtime, no restart)

Business name, logo URL, currency, tax rates, receipt/invoice template, invoice numbering,
feature flags. Loaded once into an in-memory cache at boot via a `SettingsService`
(`onModuleInit`), with the cache invalidated/refreshed whenever settings are written (a simple
in-process cache with TTL or an event emitter is sufficient at single-business scale — no need
for Redis pub/sub).

- Expose an **admin-only** `/settings` CRUD endpoint.
- Expose a **public, filtered** `/settings/public` endpoint (name, logo, currency, tax display
  rules) for the Next.js frontend to fetch on load, so nothing sensitive leaks to the browser.

### Printer config: per-machine, not per-user or per-DB

Printer configuration lives in a **local config file on each terminal**
(e.g. `%APPDATA%/onepos/printers.json`: receipt printer connection string, label printer IP/port,
default A4 printer name), keyed by terminal/machine. The central server only stores a terminal ID
reference if remote monitoring is needed later — it never stores or touches actual printer
connection details. This is what makes "reconfigure the label printer on till 3" a local,
zero-downtime, zero-redeploy action, and keeps one till's printer setup from affecting another.
See [`06-printer-integration.md`](./06-printer-integration.md) for the full printing architecture.

## Why this split (not all-env or all-DB)

- All-env would mean every branding/tax change requires editing a file and restarting the
  service — too slow for what should be a same-day admin change.
- All-DB (including the Mongo connection string itself) is circular — you can't look up "where is
  the database" inside the database.
- This hybrid matches 12-factor principles for secrets/infrastructure while keeping everything a
  business user would reasonably want to change themselves out of the deploy pipeline entirely.
