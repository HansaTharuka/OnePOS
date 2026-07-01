"use client";

import { useMemo } from "react";
import { formatMoneyCents } from "@onepos/shared-types";
import { Boxes } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory</h1>
        <p className="text-sm text-slate-500">Current stock levels across all branches.</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <Card className="overflow-hidden py-0">
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
                    <TableCell className="font-mono text-xs text-slate-500">{product?.sku ?? "—"}</TableCell>
                    <TableCell className="font-medium text-slate-900">
                      {product?.name ?? "Unknown product"}
                    </TableCell>
                    <TableCell className="text-slate-500">{row.branchId}</TableCell>
                    <TableCell className="tabular-money">
                      {row.qtyOnHand} {baseUom}
                    </TableCell>
                    <TableCell className="tabular-money text-slate-500">{row.qtyReserved}</TableCell>
                    <TableCell className="tabular-money">{formatMoneyCents(row.avgCost, "$")}</TableCell>
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
                  <TableCell colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Boxes className="h-8 w-8" />
                      <span className="text-sm">No stock recorded yet — receive stock via Goods Received.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
