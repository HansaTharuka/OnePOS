import type { SaleLineDto } from "@onepos/shared-types";
import type { ProductRecord } from "@/lib/queries/products";

export interface CartLine {
  key: string;
  productId: string;
  sku: string;
  name: string;
  uom: string;
  unitPrice: number; // integer cents — snapshot at add-time for display; server re-resolves authoritatively
  isTaxable: boolean;
  qty: number;
  discount: number; // integer cents
}

export interface CartTotals {
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
}

/**
 * Mirrors the server's per-line math in apps/api/src/modules/sales/sales.service.ts exactly
 * (lineSubtotal = unitPrice*qty - discount; tax = isTaxable ? round(lineSubtotal*rate/100) : 0)
 * so the on-screen running total matches what POST /sales will actually charge. This is a
 * display estimate only — the persisted sale is always the server's own computation.
 */
export function computeTotals(lines: CartLine[], taxRatePercent: number): CartTotals {
  let subtotal = 0;
  let taxTotal = 0;

  for (const line of lines) {
    const lineSubtotal = line.unitPrice * line.qty - line.discount;
    subtotal += lineSubtotal;
    if (line.isTaxable) {
      taxTotal += Math.round((lineSubtotal * taxRatePercent) / 100);
    }
  }

  return { subtotal, taxTotal, grandTotal: subtotal + taxTotal };
}

export interface ParsedScanInput {
  qty: number;
  term: string;
}

const QTY_TIMES_TERM = /^(\d+(?:\.\d+)?)\*(.+)$/;

/** Supports the documented `qty*sku` manual-entry pattern (e.g. "5*1234"), else qty defaults to 1. */
export function parseScanInput(raw: string): ParsedScanInput {
  const trimmed = raw.trim();
  const match = QTY_TIMES_TERM.exec(trimmed);
  if (match) {
    return { qty: Number(match[1]), term: match[2].trim() };
  }
  return { qty: 1, term: trimmed };
}

/**
 * One key per checkout attempt, reused across retries of that same attempt (e.g. a network
 * error after clicking Pay) so a resubmit can't create a duplicate sale/stock decrement — see
 * `createSaleDtoSchema.idempotencyKey` and the sales service's dedupe-by-key behavior.
 */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export interface ProductMatch {
  product: ProductRecord;
  uom: string;
}

/**
 * Matches a scanned/typed term against, in order: an exact barcode on any unit of measure, an
 * exact SKU, then a case-insensitive exact name. Barcode matches resolve to the specific UOM the
 * barcode belongs to; SKU/name matches default to the product's base unit.
 */
export function matchProduct(products: ProductRecord[], term: string): ProductMatch | null {
  if (!term) return null;
  const lower = term.toLowerCase();

  for (const product of products) {
    const uomMatch = product.unitsOfMeasure.find((u) => u.barcode === term);
    if (uomMatch) return { product, uom: uomMatch.uom };
  }

  const skuMatch = products.find((p) => p.sku.toLowerCase() === lower);
  if (skuMatch) {
    const base = skuMatch.unitsOfMeasure.find((u) => u.isBaseUnit) ?? skuMatch.unitsOfMeasure[0];
    return { product: skuMatch, uom: base.uom };
  }

  const nameMatch = products.find((p) => p.name.toLowerCase() === lower);
  if (nameMatch) {
    const base = nameMatch.unitsOfMeasure.find((u) => u.isBaseUnit) ?? nameMatch.unitsOfMeasure[0];
    return { product: nameMatch, uom: base.uom };
  }

  return null;
}

/**
 * Rebuilds full `CartLine`s for a parked sale being resumed. A parked `SaleDto`'s `lines` already
 * snapshot `unitPrice`/`qty`/`discount` from park-time pricing (so resuming restores exactly what
 * was parked, even if prices have since changed) — but `SaleLineDto` doesn't carry the display
 * fields (`sku`, `name`, `isTaxable`) that only live on the product record, so those are looked up
 * fresh here. Lines whose product no longer exists are dropped rather than crashing the resume.
 */
export function cartLinesFromParkedSale(lines: SaleLineDto[], products: ProductRecord[]): CartLine[] {
  return lines.flatMap((line) => {
    const product = products.find((p) => p._id === line.productId);
    if (!product) return [];
    return [
      {
        key: `${line.productId}:${line.uom}`,
        productId: line.productId,
        sku: product.sku,
        name: product.name,
        uom: line.uom,
        unitPrice: line.unitPrice,
        isTaxable: product.isTaxable,
        qty: line.qty,
        discount: line.discount,
      },
    ];
  });
}
