"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCategories, useDeleteCategory, type CategoryRecord } from "@/lib/queries/categories";
import { ApiError } from "@/lib/api/error";
import { CategoryFormDialog } from "./category-form-dialog";

export default function CategoriesPage() {
  const { data: categories, isLoading } = useCategories();
  const deleteCategory = useDeleteCategory();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRecord | null>(null);

  const byId = new Map((categories ?? []).map((c) => [c._id, c]));

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(category: CategoryRecord) {
    setEditing(category);
    setDialogOpen(true);
  }

  async function handleDelete(category: CategoryRecord) {
    if (!window.confirm(`Delete category "${category.name}"?`)) return;
    try {
      await deleteCategory.mutateAsync(category._id);
      toast.success("Category deleted.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Something went wrong.");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Categories</h1>
          <p className="text-sm text-slate-500">Organize products into a category hierarchy.</p>
        </div>
        <Button onClick={openCreate}>New category</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(categories ?? []).map((category) => (
                <TableRow key={category._id}>
                  <TableCell className="font-medium text-slate-900">{category.name}</TableCell>
                  <TableCell className="text-slate-500">
                    {category.parentCategoryId ? (byId.get(category.parentCategoryId)?.name ?? "—") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(category)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDelete(category)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(categories ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Tags className="h-8 w-8" />
                      <span className="text-sm">No categories yet.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <CategoryFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categories={categories ?? []}
        editing={editing}
      />
    </div>
  );
}
