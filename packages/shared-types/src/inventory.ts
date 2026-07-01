/**
 * Inventory is never written to directly by a client — it only changes via
 * GRN (increase), sale (decrease), or a future stockAdjustment (correction),
 * so there is no create/update DTO here, just the read model.
 */
export interface InventoryDto {
  id: string;
  productId: string;
  branchId: string;
  qtyOnHand: number;
  qtyReserved: number;
  avgCost: number;
  lastCountedAt?: string;
}
