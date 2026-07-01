"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatMoneyCents, PAYMENT_METHODS, type CreateSaleDto } from "@onepos/shared-types";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateSale } from "@/lib/queries/sales";
import { ApiError } from "@/lib/api/error";
import { computeTotals, type CartLine } from "@/lib/pos/cart";
import { ManagerPinDialog } from "@/components/manager-pin-dialog";
import {
  checkoutFormSchema,
  emptyPaymentRow,
  sumPaymentsCents,
  toPaymentLines,
  type CheckoutFormValues,
} from "./checkout-form-schema";

export function CheckoutDialog({
  open,
  onOpenChange,
  lines,
  taxRatePercent,
  currencySymbol,
  idempotencyKey,
  terminalId,
  shiftId,
  resumedFromParkedId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lines: CartLine[];
  taxRatePercent: number;
  currencySymbol: string;
  idempotencyKey: string;
  terminalId: string;
  shiftId: string;
  resumedFromParkedId?: string;
  onSuccess: (saleId: string) => void;
}) {
  const createSale = useCreateSale();
  const [pinOpen, setPinOpen] = useState(false);

  const totals = computeTotals(lines, taxRatePercent);

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: { payments: [{ ...emptyPaymentRow }] },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "payments" });
  const watchedPayments = useWatch({ control: form.control, name: "payments" });

  // Default the first tender row to a single cash payment covering the full total — the common
  // case is single-tender cash, and the cashier can split it into more rows from there.
  useEffect(() => {
    if (open) {
      form.reset({ payments: [{ ...emptyPaymentRow, amount: totals.grandTotal / 100 }] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const totalTenderedCents = sumPaymentsCents({ payments: watchedPayments ?? [] });
  const remaining = Math.max(totals.grandTotal - totalTenderedCents, 0);
  const changeDue = Math.max(totalTenderedCents - totals.grandTotal, 0);

  function buildDto(values: CheckoutFormValues, managerOverridePin?: string): CreateSaleDto {
    return {
      idempotencyKey,
      terminalId,
      branchId: "main",
      shiftId,
      lines: lines.map((line) => ({
        productId: line.productId,
        uom: line.uom,
        qty: line.qty,
        discount: line.discount,
      })),
      payments: toPaymentLines(values),
      managerOverridePin,
      resumedFromParkedId,
    };
  }

  // Reused for both the initial submit and the manager-override retry — same idempotencyKey both
  // times, so a retry after approval can't create a duplicate sale/stock decrement.
  async function submitSale(values: CheckoutFormValues, managerOverridePin?: string) {
    const dto = buildDto(values, managerOverridePin);
    const sale = await createSale.mutateAsync(dto);
    toast.success(`Sale ${sale.orderNo} completed.`);
    onSuccess(sale._id);
  }

  async function onSubmit(values: CheckoutFormValues) {
    try {
      await submitSale(values);
    } catch (error) {
      // Reactive check only — the backend decides whether a discount needs manager approval, we
      // don't try to predict the threshold client-side.
      if (error instanceof ApiError && error.status === 400 && /manager approval/i.test(error.message)) {
        setPinOpen(true);
        return;
      }
      toast.error(error instanceof ApiError ? error.message : "Something went wrong.");
    }
  }

  async function handlePinSubmit(pin: string) {
    await submitSale(form.getValues(), pin);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment</DialogTitle>
            <DialogDescription>
              Totals shown are an estimate — the server computes the final charge.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Subtotal</span>
              <span>{formatMoneyCents(totals.subtotal, currencySymbol)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Tax</span>
              <span>{formatMoneyCents(totals.taxTotal, currencySymbol)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Total due</span>
              <span>{formatMoneyCents(totals.grandTotal, currencySymbol)}</span>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Tender</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ ...emptyPaymentRow })}>
                  Add tender
                </Button>
              </div>
              {form.formState.errors.payments?.root && (
                <p className="text-sm font-medium text-red-600">
                  {form.formState.errors.payments.root.message}
                </p>
              )}

              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 items-end gap-2">
                    <div className="col-span-4">
                      <FormField
                        control={form.control}
                        name={`payments.${index}.method`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Method</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {PAYMENT_METHODS.map((method) => (
                                  <SelectItem key={method} value={method} className="capitalize">
                                    {method}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="col-span-3">
                      <FormField
                        control={form.control}
                        name={`payments.${index}.amount`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Amount</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" autoFocus={index === 0} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="col-span-4">
                      <FormField
                        control={form.control}
                        name={`payments.${index}.reference`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Reference (optional)</FormLabel>
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

              <div className="space-y-1 border-t border-zinc-200 pt-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Remaining balance</span>
                  <span className={remaining > 0 ? "font-medium text-red-600" : "font-medium"}>
                    {formatMoneyCents(remaining, currencySymbol)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Change due</span>
                  <span className="font-medium">{formatMoneyCents(changeDue, currencySymbol)}</span>
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={createSale.isPending || remaining > 0}>
                  {createSale.isPending ? "Processing…" : "Confirm payment"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ManagerPinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        title="Manager approval required"
        description="This sale's discount requires manager approval to proceed."
        onSubmit={handlePinSubmit}
      />
    </>
  );
}
