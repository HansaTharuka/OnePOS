"use client";

import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useProducts, type ProductRecord } from "@/lib/queries/products";
import { useCreateGrn } from "@/lib/queries/grn";
import { ApiError } from "@/lib/api/error";
import {
  defaultGrnFormValues,
  emptyGrnLine,
  grnFormSchema,
  toCreateGrnDto,
  type GrnFormValues,
} from "./grn-form-schema";

function UomSelect({
  control,
  index,
  products,
}: {
  control: ReturnType<typeof useForm<GrnFormValues>>["control"];
  index: number;
  products: ProductRecord[];
}) {
  const productId = useWatch({ control, name: `lines.${index}.productId` });
  const product = products.find((p) => p._id === productId);

  return (
    <FormField
      control={control}
      name={`lines.${index}.uom`}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">UOM</FormLabel>
          <Select value={field.value} onValueChange={field.onChange} disabled={!product}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={product ? "Select" : "Pick a product first"} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {(product?.unitsOfMeasure ?? []).map((u) => (
                <SelectItem key={u.uom} value={u.uom}>
                  {u.uom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function GrnForm() {
  const router = useRouter();
  const { data: products } = useProducts();
  const createGrn = useCreateGrn();

  const form = useForm<GrnFormValues>({
    resolver: zodResolver(grnFormSchema),
    defaultValues: defaultGrnFormValues,
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });

  async function onSubmit(values: GrnFormValues) {
    try {
      const grn = await createGrn.mutateAsync(toCreateGrnDto(values));
      toast.success(`Goods received note ${grn.grnNumber} created.`);
      router.push("/goods-received");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Something went wrong.");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-4xl space-y-6">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Lines</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ ...emptyGrnLine })}>
              Add line
            </Button>
          </div>
          {form.formState.errors.lines?.root && (
            <p className="mb-2 text-sm font-medium text-red-600">
              {form.formState.errors.lines.root.message}
            </p>
          )}
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-12 items-end gap-2 rounded-md border border-zinc-200 p-3"
              >
                <div className="col-span-3">
                  <FormField
                    control={form.control}
                    name={`lines.${index}.productId`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Product</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue(`lines.${index}.uom`, "");
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a product" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(products ?? []).map((product) => (
                              <SelectItem key={product._id} value={product._id}>
                                {product.sku} — {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="col-span-2">
                  <UomSelect control={form.control} index={index} products={products ?? []} />
                </div>
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name={`lines.${index}.qtyReceived`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Qty received</FormLabel>
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
                    name={`lines.${index}.unitCost`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Unit cost</FormLabel>
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
                    name={`lines.${index}.batchNo`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Batch # (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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

        <FormField
          control={form.control}
          name="discrepancyNotes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Discrepancy notes (optional)</FormLabel>
              <FormControl>
                <textarea
                  {...field}
                  rows={3}
                  className="flex w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button type="submit" disabled={createGrn.isPending}>
            {createGrn.isPending ? "Saving…" : "Receive stock"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/goods-received")}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
