"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBrandDtoSchema, type CreateBrandDto } from "@onepos/shared-types";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCreateBrand, useUpdateBrand, type BrandRecord } from "@/lib/queries/brands";
import { ApiError } from "@/lib/api/error";

export function BrandFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: BrandRecord | null;
}) {
  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();

  const form = useForm<CreateBrandDto>({
    resolver: zodResolver(createBrandDtoSchema),
    defaultValues: { name: "", supplierIds: [] },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: editing?.name ?? "", supplierIds: editing?.supplierIds ?? [] });
    }
  }, [open, editing, form]);

  async function onSubmit(values: CreateBrandDto) {
    try {
      if (editing) {
        await updateBrand.mutateAsync({ id: editing._id, dto: values });
        toast.success("Brand updated.");
      } else {
        await createBrand.mutateAsync(values);
        toast.success("Brand created.");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Something went wrong.");
    }
  }

  const pending = createBrand.isPending || updateBrand.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit brand" : "New brand"}</DialogTitle>
          <DialogDescription>Brands can optionally link to preferred suppliers.</DialogDescription>
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
