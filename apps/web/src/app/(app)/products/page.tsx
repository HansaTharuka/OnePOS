"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatMoneyCents } from "@onepos/shared-types";
import { Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProducts } from "@/lib/queries/products";
import { useCategories } from "@/lib/queries/categories";

export default function ProductsPage() {
  const { data: products, isLoading } = useProducts();
  const { data: categories } = useCategories();
  const [search, setSearch] = useState("");

  const categoryNameById = useMemo(
    () => new Map((categories ?? []).map((c) => [c._id, c.name])),
    [categories],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products ?? [];
    return (products ?? []).filter(
      (p) =>
        p.sku.toLowerCase().includes(term) ||
        p.name.toLowerCase().includes(term) ||
        p.unitsOfMeasure.some((u) => u.barcode?.toLowerCase().includes(term)),
    );
  }, [products, search]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Products</h1>
          <p className="text-sm text-slate-500">Manage your catalog, pricing, and units of measure.</p>
        </div>
        <Button asChild>
          <Link href="/products/new">New product</Link>
        </Button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search by SKU, name, or barcode…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Base price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((product) => {
                const baseUnit = product.unitsOfMeasure.find((u) => u.isBaseUnit);
                return (
                  <TableRow key={product._id}>
                    <TableCell className="font-mono text-xs text-slate-500">{product.sku}</TableCell>
                    <TableCell className="font-medium text-slate-900">{product.name}</TableCell>
                    <TableCell className="text-slate-500">
                      {categoryNameById.get(product.categoryId) ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-money">
                      {baseUnit ? formatMoneyCents(baseUnit.sellPrice, "$") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.isActive ? "success" : "secondary"}>
                        {product.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/products/${product._id}`}>Edit</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Package className="h-8 w-8" />
                      <span className="text-sm">No products found.</span>
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
