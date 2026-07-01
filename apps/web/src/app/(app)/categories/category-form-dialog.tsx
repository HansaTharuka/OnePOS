"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCategoryDtoSchema, type CreateCategoryDto } from "@onepos/shared-types";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCreateCategory, useUpdateCategory, type CategoryRecord } from "@/lib/queries/categories";
import { ApiError } from "@/lib/api/error";

export function CategoryFormDialog({
  open,
  onOpenChange,
  categories,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryRecord[];
  editing: CategoryRecord | null;
}) {
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const form = useForm<CreateCategoryDto>({
    resolver: zodResolver(createCategoryDtoSchema),
    defaultValues: { name: "", parentCategoryId: undefined, imagePath: undefined },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: editing?.name ?? "",
        parentCategoryId: editing?.parentCategoryId,
        imagePath: editing?.imagePath,
      });
    }
  }, [open, editing, form]);

  async function onSubmit(values: CreateCategoryDto) {
    try {
      if (editing) {
        await updateCategory.mutateAsync({ id: editing._id, dto: values });
        toast.success("Category updated.");
      } else {
        await createCategory.mutateAsync(values);
        toast.success("Category created.");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Something went wrong.");
    }
  }

  const parentOptions = categories.filter((c) => c._id !== editing?._id);
  const pending = createCategory.isPending || updateCategory.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parentCategoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent category (optional)</FormLabel>
                  <Select
                    value={field.value ?? "__none__"}
                    onValueChange={(value) => field.onChange(value === "__none__" ? undefined : value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {parentOptions.map((category) => (
                        <SelectItem key={category._id} value={category._id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
