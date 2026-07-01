import { describe, expect, it } from "vitest";
import {
  computeTotals,
  matchProduct,
  newIdempotencyKey,
  parseScanInput,
  type CartLine,
} from "./cart";
import type { ProductRecord } from "@/lib/queries/products";

function makeProduct(overrides: Partial<ProductRecord> = {}): ProductRecord {
  return {
    _id: "p1",
    sku: "SCR-001",
    name: "Wood Screw 1in",
    categoryId: "c1",
    unitsOfMeasure: [
      { uom: "piece", conversionFactor: 1, barcode: "1111111111111", costPrice: 5, sellPrice: 10, isBaseUnit: true },
      { uom: "box", conversionFactor: 100, barcode: "2222222222222", costPrice: 400, sellPrice: 900, isBaseUnit: false },
    ],
    reorderPoint: 0,
    reorderQty: 0,
    isWeighted: false,
    isTaxable: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    key: "p1:piece",
    productId: "p1",
    sku: "SCR-001",
    name: "Wood Screw 1in",
    uom: "piece",
    unitPrice: 10,
    isTaxable: true,
    qty: 1,
    discount: 0,
    ...overrides,
  };
}

describe("computeTotals", () => {
  it("mirrors the server's per-line math: lineSubtotal = unitPrice*qty - discount", () => {
    const lines = [makeLine({ unitPrice: 499, qty: 2, discount: 0 })];
    const totals = computeTotals(lines, 0);
    expect(totals.subtotal).toBe(998);
    expect(totals.taxTotal).toBe(0);
    expect(totals.grandTotal).toBe(998);
  });

  it("applies per-line discount before tax", () => {
    const lines = [makeLine({ unitPrice: 1000, qty: 1, discount: 200 })];
    const totals = computeTotals(lines, 10);
    expect(totals.subtotal).toBe(800);
    expect(totals.taxTotal).toBe(80);
    expect(totals.grandTotal).toBe(880);
  });

  it("skips tax for non-taxable lines", () => {
    const lines = [makeLine({ unitPrice: 1000, qty: 1, isTaxable: false })];
    const totals = computeTotals(lines, 10);
    expect(totals.taxTotal).toBe(0);
  });

  it("rounds tax per line the same way the server does (Math.round)", () => {
    // 1028 * 8 / 100 = 82.24 -> rounds to 82, matching the live-verified example from manual testing
    const lines = [makeLine({ unitPrice: 1028, qty: 1 })];
    const totals = computeTotals(lines, 8);
    expect(totals.taxTotal).toBe(82);
  });

  it("sums across multiple lines", () => {
    const lines = [
      makeLine({ key: "a", unitPrice: 499, qty: 2 }),
      makeLine({ key: "b", unitPrice: 10, qty: 3 }),
    ];
    const totals = computeTotals(lines, 8);
    expect(totals.subtotal).toBe(1028);
  });
});

describe("parseScanInput", () => {
  it("defaults to qty 1 for a plain scan/sku", () => {
    expect(parseScanInput("1234567890123")).toEqual({ qty: 1, term: "1234567890123" });
  });

  it("parses the documented qty*sku pattern", () => {
    expect(parseScanInput("5*1234")).toEqual({ qty: 5, term: "1234" });
  });

  it("supports fractional qty for weighted items", () => {
    expect(parseScanInput("2.5*SCR-001")).toEqual({ qty: 2.5, term: "SCR-001" });
  });

  it("trims surrounding whitespace", () => {
    expect(parseScanInput("  SCR-001  ")).toEqual({ qty: 1, term: "SCR-001" });
  });
});

describe("matchProduct", () => {
  const products = [makeProduct()];

  it("matches an exact barcode and resolves to that barcode's uom", () => {
    const match = matchProduct(products, "2222222222222");
    expect(match?.uom).toBe("box");
  });

  it("matches by SKU and defaults to the base unit", () => {
    const match = matchProduct(products, "SCR-001");
    expect(match?.uom).toBe("piece");
  });

  it("matches by SKU case-insensitively", () => {
    const match = matchProduct(products, "scr-001");
    expect(match?.product.sku).toBe("SCR-001");
  });

  it("matches by exact product name", () => {
    const match = matchProduct(products, "Wood Screw 1in");
    expect(match?.product._id).toBe("p1");
  });

  it("returns null when nothing matches", () => {
    expect(matchProduct(products, "does-not-exist")).toBeNull();
  });

  it("returns null for an empty term", () => {
    expect(matchProduct(products, "")).toBeNull();
  });
});

describe("newIdempotencyKey", () => {
  it("generates a unique value on each call", () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });
});
