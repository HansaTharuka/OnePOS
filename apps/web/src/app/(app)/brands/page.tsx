"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBrands, useDeleteBrand, type BrandRecord } from "@/lib/queries/brands";
import { ApiError } from "@/lib/api/error";
import { BrandFormDialog } from "./brand-form-dialog";

export default function BrandsPage() {
  const { data: brands, isLoading } = useBrands();
  const deleteBrand = useDeleteBrand();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BrandRecord | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(brand: BrandRecord) {
    setEditing(brand);
    setDialogOpen(true);
  }

  async function handleDelete(brand: BrandRecord) {
    if (!window.confirm(`Delete brand "${brand.name}"?`)) return;
    try {
      await deleteBrand.mutateAsync(brand._id);
      toast.success("Brand deleted.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Something went wrong.");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Brands</h1>
          <p className="text-sm text-slate-500">Manage the brands your products are sold under.</p>
        </div>
        <Button onClick={openCreate}>New brand</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(brands ?? []).map((brand) => (
                <TableRow key={brand._id}>
                  <TableCell className="font-medium text-slate-900">{brand.name}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(brand)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDelete(brand)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(brands ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <BadgeCheck className="h-8 w-8" />
                      <span className="text-sm">No brands yet.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <BrandFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
    </div>
  );
}
