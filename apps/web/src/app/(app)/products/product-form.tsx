"use client";

import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useCategories } from "@/lib/queries/categories";
import { useBrands } from "@/lib/queries/brands";
import { useCreateProduct, useUpdateProduct, type ProductRecord } from "@/lib/queries/products";
import { ApiError } from "@/lib/api/error";
import {
  defaultProductFormValues,
  emptyUnitOfMeasure,
  productFormSchema,
  toCreateProductDto,
  type ProductFormValues,
} from "./product-form-schema";

function toFormValues(product: ProductRecord): ProductFormValues {
  return {
    sku: product.sku,
    name: product.name,
    categoryId: product.categoryId,
    brandId: product.brandId,
    unitsOfMeasure: product.unitsOfMeasure.map((u) => ({
      uom: u.uom,
      conversionFactor: u.conversionFactor,
      barcode: u.barcode ?? "",
      costPrice: u.costPrice / 100,
      sellPrice: u.sellPrice / 100,
      isBaseUnit: u.isBaseUnit,
    })),
    reorderPoint: product.reorderPoint,
    reorderQty: product.reorderQty,
    isWeighted: product.isWeighted,
    isTaxable: product.isTaxable,
    isActive: product.isActive,
    imageUrl: product.imageUrl,
  };
}

export function ProductForm({ editing }: { editing?: ProductRecord }) {
  const router = useRouter();
  const { data: categories } = useCategories();
  const { data: brands } = useBrands();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: editing ? toFormValues(editing) : defaultProductFormValues,
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "unitsOfMeasure",
  });

  function markAsBaseUnit(index: number) {
    fields.forEach((field, i) => {
      update(i, { ...form.getValues(`unitsOfMeasure.${i}`), isBaseUnit: i === index });
    });
  }

  async function onSubmit(values: ProductFormValues) {
    const dto = toCreateProductDto(values);
    try {
      if (editing) {
        await updateProduct.mutateAsync({ id: editing._id, dto });
        toast.success("Product updated.");
      } else {
        await createProduct.mutateAsync(dto);
        toast.success("Product created.");
      }
      router.push("/products");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Something went wrong.");
    }
  }

  const pending = createProduct.isPending || updateProduct.isPending;

  return (
    <Card className="max-w-3xl">
      <CardContent className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Basic info</h2>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="sku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SKU</FormLabel>
                <FormControl>
                  <Input autoFocus {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(categories ?? []).map((category) => (
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
          <FormField
            control={form.control}
            name="brandId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Brand (optional)</FormLabel>
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
                    {(brands ?? []).map((brand) => (
                      <SelectItem key={brand._id} value={brand._id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <div className="mb-3 flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Units of measure
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ ...emptyUnitOfMeasure })}
            >
              Add unit
            </Button>
          </div>
          {form.formState.errors.unitsOfMeasure?.root && (
            <p className="mb-2 text-sm font-medium text-red-600">
              {form.formState.errors.unitsOfMeasure.root.message}
            </p>
          )}
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-slate-200 p-3">
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name={`unitsOfMeasure.${index}.uom`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">UOM</FormLabel>
                        <FormControl>
                          <Input placeholder="piece" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name={`unitsOfMeasure.${index}.conversionFactor`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Conv. factor</FormLabel>
                        <FormControl>
                          <Input type="number" step="any" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name={`unitsOfMeasure.${index}.barcode`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Barcode</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name={`unitsOfMeasure.${index}.costPrice`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Cost price</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name={`unitsOfMeasure.${index}.sellPrice`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Sell price</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="col-span-1 flex items-center gap-1 pb-2">
                  <Checkbox
                    checked={field.isBaseUnit}
                    onCheckedChange={() => markAsBaseUnit(index)}
                  />
                  <span className="text-xs text-slate-500">Base</span>
                </div>
                <div className="col-span-1 flex justify-end pb-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={fields.length === 1}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Stock & flags</h2>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="reorderPoint"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reorder point</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="reorderQty"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reorder quantity</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="mt-4 flex gap-6">
          <FormField
            control={form.control}
            name="isWeighted"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="font-normal">Sold by weight</FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isTaxable"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="font-normal">Taxable</FormLabel>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="font-normal">Active</FormLabel>
              </FormItem>
            )}
          />
        </div>
        </div>

        <div className="flex gap-2 border-t border-slate-100 pt-6">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : editing ? "Save changes" : "Create product"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/products")}>
            Cancel
          </Button>
        </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
