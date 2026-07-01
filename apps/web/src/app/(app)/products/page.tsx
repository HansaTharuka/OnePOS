"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatMoneyCents } from "@onepos/shared-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Products</h1>
        <Button asChild>
          <Link href="/products/new">New product</Link>
        </Button>
      </div>

      <Input
        placeholder="Search by SKU, name, or barcode…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 max-w-sm"
      />

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
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
                  <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-zinc-500">
                    {categoryNameById.get(product.categoryId) ?? "—"}
                  </TableCell>
                  <TableCell>{baseUnit ? formatMoneyCents(baseUnit.sellPrice, "$") : "—"}</TableCell>
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
                <TableCell colSpan={6} className="py-6 text-center text-sm text-zinc-500">
                  No products found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
