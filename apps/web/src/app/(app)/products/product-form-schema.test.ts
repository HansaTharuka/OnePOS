import { describe, expect, it } from "vitest";
import { defaultProductFormValues, productFormSchema, toCreateProductDto } from "./product-form-schema";

describe("toCreateProductDto", () => {
  it("converts dollar-denominated prices to integer cents", () => {
    const dto = toCreateProductDto({
      ...defaultProductFormValues,
      sku: "SCR-001",
      name: "Wood Screw 1in",
      categoryId: "c1",
      unitsOfMeasure: [
        { uom: "piece", conversionFactor: 1, barcode: "", costPrice: 0.05, sellPrice: 0.1, isBaseUnit: true },
      ],
    });
    expect(dto.unitsOfMeasure[0].costPrice).toBe(5);
    expect(dto.unitsOfMeasure[0].sellPrice).toBe(10);
  });

  it("rounds fractional cents the same way toMoneyCents does", () => {
    const dto = toCreateProductDto({
      ...defaultProductFormValues,
      sku: "X",
      name: "X",
      categoryId: "c1",
      unitsOfMeasure: [
        { uom: "piece", conversionFactor: 1, barcode: "", costPrice: 2.999, sellPrice: 4.995, isBaseUnit: true },
      ],
    });
    expect(dto.unitsOfMeasure[0].costPrice).toBe(300);
    expect(dto.unitsOfMeasure[0].sellPrice).toBe(500);
  });

  it("drops empty optional strings to undefined rather than sending empty strings", () => {
    const dto = toCreateProductDto({
      ...defaultProductFormValues,
      sku: "X",
      name: "X",
      categoryId: "c1",
      brandId: "",
      imageUrl: "",
      unitsOfMeasure: [
        { uom: "piece", conversionFactor: 1, barcode: "", costPrice: 1, sellPrice: 2, isBaseUnit: true },
      ],
    });
    expect(dto.brandId).toBeUndefined();
    expect(dto.imageUrl).toBeUndefined();
    expect(dto.unitsOfMeasure[0].barcode).toBeUndefined();
  });
});

describe("productFormSchema", () => {
  it("rejects zero base units", () => {
    const result = productFormSchema.safeParse({
      ...defaultProductFormValues,
      sku: "X",
      name: "X",
      categoryId: "c1",
      unitsOfMeasure: [
        { uom: "piece", conversionFactor: 1, costPrice: 1, sellPrice: 2, isBaseUnit: false },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than one base unit", () => {
    const result = productFormSchema.safeParse({
      ...defaultProductFormValues,
      sku: "X",
      name: "X",
      categoryId: "c1",
      unitsOfMeasure: [
        { uom: "piece", conversionFactor: 1, costPrice: 1, sellPrice: 2, isBaseUnit: true },
        { uom: "box", conversionFactor: 10, costPrice: 10, sellPrice: 20, isBaseUnit: true },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts exactly one base unit", () => {
    const result = productFormSchema.safeParse({
      ...defaultProductFormValues,
      sku: "X",
      name: "X",
      categoryId: "c1",
      unitsOfMeasure: [
        { uom: "piece", conversionFactor: 1, costPrice: 1, sellPrice: 2, isBaseUnit: true },
        { uom: "box", conversionFactor: 10, costPrice: 10, sellPrice: 20, isBaseUnit: false },
      ],
    });
    expect(result.success).toBe(true);
  });
});
