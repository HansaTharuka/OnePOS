# Data Model (MongoDB)

Modeled for a hardware/retail business specifically: items are often sold by piece, by weight or
length, or in bulk packs, with supplier/purchase-order tracking and trade/contractor pricing.

## Collections

- **`categories`** — name, `parentCategoryId` (tree, e.g. Plumbing → Pipes → PVC), `taxClassId`, `imagePath`
- **`brands`** — name, `supplierIds[]` (brands often map to preferred suppliers)
- **`products`** — sku, name, `categoryId`, `brandId`, **`unitsOfMeasure[]`**:
  `{ uom: "piece"|"box"|"kg"|"meter", conversionFactor, barcode, costPrice, sellPrice, isBaseUnit }`
  — critical for hardware: nuts sold per-piece *and* per-box-of-100, wire cut per-meter from a
  spool. Also: `reorderPoint`, `reorderQty`, `isWeighted`, `isTaxable`, `isActive`, `imageUrl`.
- **`suppliers`** — name, contact, paymentTerms, leadTimeDays, `linkedProductIds[]`, outstandingBalance
- **`purchaseOrders`** — poNumber, supplierId, status (draft/sent/partial/received/closed),
  lines `[{ productId, uom, qtyOrdered, unitCost }]`, expectedDate
- **`goodsReceivedNotes` (GRN)** — poId (nullable for walk-in stock),
  lines `[{ productId, uom, qtyReceived, unitCost, batchNo? }]`, receivedBy, discrepancyNotes.
  **This is the actual stock-increasing event**, deliberately decoupled from the PO — a PO can be
  partially received, over-received, or received without ever having existed.
- **`inventory`** (per branch/terminal-group) — productId, branchId, `qtyOnHand` (stored in base
  UOM only, converted via the product's UOM table), `qtyReserved`, `avgCost` (for margin calc),
  `lastCountedAt`
- **`stockAdjustments`** — productId, branchId, type (damage/shrinkage/count-correction/expiry),
  qtyDelta, reason, approvedBy, reference
- **`stockTransfers`** — fromBranchId, toBranchId, lines[], status (pending/in-transit/received),
  requestedBy/receivedBy
- **`customers`** — name, phone, creditLimit, currentBalance, loyaltyPoints, priceTier (for
  contractor/trade discounts, common in hardware retail)
- **`sales`** — orderNo, cashierId, terminalId, shiftId, customerId?,
  lines `[{ productId, uom, qty, unitPrice, discount, taxAmount, lineTotal }]`, payments[],
  subtotal, taxTotal, grandTotal, status (completed/voided/parked).
  **Lines snapshot price/tax/uom at time of sale — never live-reference the product doc.**
- **`payments`** — saleId, method (cash/card/mobile/credit/split), amount, reference/authCode, changeGiven
- **`returns`** — originalSaleId, lines[], reason, refundMethod, restockFlag (resellable vs damaged), approvedBy
- **`discounts` / `promotions`** — type (percentage/fixed/BOGO/tiered), scope (product/category/cart),
  startDate/endDate, minQty, requiresApproval
- **`taxes` / `taxClasses`** — name, rate, jurisdiction (some regions exempt certain hardware/agri items)
- **`paymentMethods`** (config) — name, requiresReference, surchargeRate
- **`shifts` / `tills`** — terminalId, cashierId, openingFloat, closingCountedCash, expectedCash,
  variance, openedAt/closedAt, status
- **`cashDrawerMovements`** — shiftId, type (paid-in/paid-out/drop/opening), amount, reason, authorizedBy
- **`users`**, **`roles`/`permissions`** — see [`03-rbac-permissions.md`](./03-rbac-permissions.md).
  Users also carry a `pinCode` for quick manager-approval entry at the till.
- **`settings`** — see [`04-configuration.md`](./04-configuration.md)
- **`auditLogs`** — entityType, entityId, action, userId, before/after diff, timestamp, terminalId
  — mandatory for price overrides, voids, refunds, manual stock changes

## Key relational notes

- `inventory` is per-branch, **not embedded** in the product document.
- Sales, once completed, never look back at the live `products` collection for price/tax — they
  are historical snapshots. This is what keeps old receipts and reports accurate after a price
  change.
- Every mutating write to stock goes through one of three explicit paths: GRN (increase),
  sale (decrease), or stockAdjustment (correction) — there is no other route that changes
  `qtyOnHand`, which is what makes the audit trail complete.

## Common QA pitfalls to guard against (from domain research)

- Floating-point currency math — use integer cents or `Decimal128`, never JS `float`.
- Race conditions on concurrent stock decrement (two terminals selling the last unit) — needs
  atomic `findOneAndUpdate` with a quantity guard, not read-then-write.
- Negative stock silently allowed — decide the policy explicitly (block/warn/allow-backorder).
- UOM conversion bugs (selling "1 box" but decrementing 1 piece instead of the box's piece count).
- Printer/receipt failure blocking sale completion — the sale must commit to the DB first;
  printing/retry is decoupled and re-triggerable.
- Tax rounding differences between line-level and cart-level rounding causing receipt totals to
  mismatch.
- Refund exceeding the original sale amount, or refunding an already-refunded line — track
  refund state at the line level.
- Discount stacking producing negative-price or unintended free items.
- Clock/timezone issues on shift open/close spanning midnight.
- Offline mode / network drop mid-sale creating duplicate or orphaned transactions — mitigated by
  per-sale idempotency keys (see doc 05).
- Audit trail gaps on manual overrides making fraud/shrinkage investigation impossible.
