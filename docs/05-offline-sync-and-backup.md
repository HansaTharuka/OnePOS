# Offline-First Terminals, Sync & Backup/Disaster Recovery

## Offline-first architecture

### Local store: SQLite, not IndexedDB or local MongoDB

Use embedded SQLite (`better-sqlite3`) inside the Electron app as the terminal's local
write-ahead store:

- **Not IndexedDB** — too tied to the browser renderer, harder to query relationally.
- **Not a full local MongoDB** — heavy footprint, unnecessary on a cashier PC.

Structure: mirror the sale/line-item schema, plus an `outbox` table of pending mutations.

### Sync

A background sync worker in the Electron main process pushes the outbox to NestJS once
connectivity returns, and pulls server deltas since `lastSyncTimestamp`.

### Conflict resolution: event-sourced sales, not merged state

Do **not** try to merge conflicting quantity edits client-side. Treat each sale as an
append-only event ("sold N units of SKU X at time T") rather than a state overwrite:

- The server replays events and performs the atomic stock decrement centrally
  (see [`01-architecture-overview.md`](./01-architecture-overview.md) — multi-terminal race
  conditions).
- Offline sales are provisional/optimistic locally, reconciled server-side.
- A true stockout discovered only at sync time (rare in small retail) raises a **manager-review
  flag** rather than silently going negative or corrupting data.
- Use **server-assigned sequence numbers**, not client timestamps, as the source of truth for
  ordering — terminal clocks can and will skew.
- Every sale carries a **client-generated idempotency key** so a retried sync can never create a
  duplicate transaction.

### MongoDB Realm / Atlas Device Sync — confirmed dead, do not use

MongoDB announced deprecation of Realm/Device Sync in September 2024; the sync service **shut
down September 30, 2025**. This was considered and ruled out — the offline sync layer is rolled
by hand via the SQLite outbox + REST/NestJS endpoint pattern above, not on any MongoDB-provided
sync product.

## Backup & disaster recovery

Given the target scale (small/medium retail, not cloud-scale):

- Run MongoDB as a **minimal replica set** — even just one primary + one local secondary or
  arbiter — purely to enable oplog-based backups.
- Schedule nightly `mongodump --oplog` from the secondary, retain 7–14 days locally, plus a daily
  off-site copy (cloud storage or NAS).
- **Replication is not a backup.** It propagates deletions instantly, so `mongodump` snapshots are
  still required for point-in-time restore and protection against corruption or ransomware.
- Document and periodically test the actual restore procedure — an untested backup is not a
  backup.

## Sources consulted

- Tauri vs Electron 2026 comparison; Best Desktop App Frameworks 2026 (packaging decision, see doc 01)
- MongoDB community forum: "Device Sync and Edge Server are Deprecated"; mobile engineering
  newsletter coverage of the Realm deprecation
- MongoDB manual: Backup Methods; Percona: MongoDB Backup Best Practices
- Articles on MongoDB atomic operations to avoid race conditions; production case study on
  eliminating inventory race conditions in e-commerce
- LogRocket: Offline-first frontend apps 2025 (IndexedDB vs SQLite)
