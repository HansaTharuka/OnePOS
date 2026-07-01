import { describe, expect, it } from "vitest";
import { toCreateGrnDto } from "./grn-form-schema";

describe("toCreateGrnDto", () => {
  it("converts dollar unit cost to integer cents and fixes branchId to 'main'", () => {
    const dto = toCreateGrnDto({
      lines: [{ productId: "p1", uom: "piece", qtyReceived: 50, unitCost: 2.75, batchNo: "" }],
      discrepancyNotes: undefined,
    });
    expect(dto.branchId).toBe("main");
    expect(dto.lines[0].unitCost).toBe(275);
    expect(dto.lines[0].batchNo).toBeUndefined();
  });

  it("drops an empty discrepancyNotes string to undefined", () => {
    const dto = toCreateGrnDto({
      lines: [{ productId: "p1", uom: "piece", qtyReceived: 1, unitCost: 1, batchNo: "" }],
      discrepancyNotes: "",
    });
    expect(dto.discrepancyNotes).toBeUndefined();
  });

  it("preserves multiple lines independently", () => {
    const dto = toCreateGrnDto({
      lines: [
        { productId: "p1", uom: "piece", qtyReceived: 100, unitCost: 0.05, batchNo: "" },
        { productId: "p1", uom: "box", qtyReceived: 5, unitCost: 20, batchNo: "B123" },
      ],
      discrepancyNotes: undefined,
    });
    expect(dto.lines).toHaveLength(2);
    expect(dto.lines[0].unitCost).toBe(5);
    expect(dto.lines[1].unitCost).toBe(2000);
    expect(dto.lines[1].batchNo).toBe("B123");
  });
});
