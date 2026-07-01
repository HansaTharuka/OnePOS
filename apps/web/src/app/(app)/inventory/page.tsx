"use client";

import { useMemo } from "react";
import { formatMoneyCents } from "@onepos/shared-types";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInventory } from "@/lib/queries/inventory";
import { useProducts } from "@/lib/queries/products";

export default function InventoryPage() {
  const { data: inventory, isLoading: loadingInventory } = useInventory();
  const { data: products, isLoading: loadingProducts } = useProducts();

  const productById = useMemo(() => new Map((products ?? []).map((p) => [p._id, p])), [products]);
  const isLoading = loadingInventory || loadingProducts;

  const rows = useMemo(() => {
    return (inventory ?? [])
      .map((row) => ({ row, product: productById.get(row.productId) }))
      .sort((a, b) => (a.product?.name ?? "").localeCompare(b.product?.name ?? ""));
  }, [inventory, productById]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-zinc-900">Inventory</h1>

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Qty on hand</TableHead>
              <TableHead>Reserved</TableHead>
              <TableHead>Avg. cost</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ row, product }) => {
              const baseUom = product?.unitsOfMeasure.find((u) => u.isBaseUnit)?.uom ?? "unit";
              const lowStock = product ? row.qtyOnHand <= product.reorderPoint : false;
              return (
                <TableRow key={row._id}>
                  <TableCell className="font-mono text-xs">{product?.sku ?? "—"}</TableCell>
                  <TableCell className="font-medium">{product?.name ?? "Unknown product"}</TableCell>
                  <TableCell className="text-zinc-500">{row.branchId}</TableCell>
                  <TableCell>
                    {row.qtyOnHand} {baseUom}
                  </TableCell>
                  <TableCell className="text-zinc-500">{row.qtyReserved}</TableCell>
                  <TableCell>{formatMoneyCents(row.avgCost, "$")}</TableCell>
                  <TableCell>
                    {lowStock ? (
                      <Badge variant="warning">Low stock</Badge>
                    ) : (
                      <Badge variant="secondary">OK</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-sm text-zinc-500">
                  No stock recorded yet — receive stock via Goods Received.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
