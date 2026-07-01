import { describe, expect, it } from "vitest";
import { checkoutFormSchema, sumPaymentsCents, toPaymentLines } from "./checkout-form-schema";

describe("toPaymentLines", () => {
  it("converts dollar-denominated tender amounts to integer cents", () => {
    const lines = toPaymentLines({
      payments: [{ method: "cash", amount: 12.5, reference: undefined }],
    });
    expect(lines).toEqual([{ method: "cash", amount: 1250, reference: undefined }]);
  });

  it("drops an empty reference to undefined rather than sending an empty string", () => {
    const lines = toPaymentLines({ payments: [{ method: "card", amount: 5, reference: "" }] });
    expect(lines[0].reference).toBeUndefined();
  });

  it("supports multiple split-tender rows", () => {
    const lines = toPaymentLines({
      payments: [
        { method: "cash", amount: 10 },
        { method: "card", amount: 5.25, reference: "auth-123" },
      ],
    });
    expect(lines).toEqual([
      { method: "cash", amount: 1000, reference: undefined },
      { method: "card", amount: 525, reference: "auth-123" },
    ]);
  });
});

describe("sumPaymentsCents", () => {
  it("sums tender rows in integer cents", () => {
    const total = sumPaymentsCents({
      payments: [{ method: "cash", amount: 10 }, { method: "card", amount: 5.25 }],
    });
    expect(total).toBe(1525);
  });

  it("treats a blank/NaN amount as zero rather than throwing", () => {
    const total = sumPaymentsCents({ payments: [{ method: "cash", amount: Number("") }] });
    expect(total).toBe(0);
  });
});

describe("checkoutFormSchema", () => {
  it("requires at least one tender row", () => {
    const result = checkoutFormSchema.safeParse({ payments: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive tender amount", () => {
    const result = checkoutFormSchema.safeParse({ payments: [{ method: "cash", amount: 0 }] });
    expect(result.success).toBe(false);
  });

  it("accepts a valid split-tender payload", () => {
    const result = checkoutFormSchema.safeParse({
      payments: [
        { method: "cash", amount: 10 },
        { method: "mobile", amount: 2.5, reference: "txn-1" },
      ],
    });
    expect(result.success).toBe(true);
  });
});
