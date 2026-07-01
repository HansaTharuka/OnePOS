"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Categories</h1>
        <Button onClick={openCreate}>New category</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
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
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell className="text-zinc-500">
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
                <TableCell colSpan={3} className="py-6 text-center text-sm text-zinc-500">
                  No categories yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
