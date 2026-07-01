"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatMoneyCents, toMoneyCents } from "@onepos/shared-types";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCloseShift, type ShiftRecord } from "@/lib/queries/shifts";
import { ApiError } from "@/lib/api/error";

const closeShiftFormSchema = z.object({
  closingCountedCash: z.coerce.number().nonnegative("Must be 0 or more"),
});
type CloseShiftFormValues = z.infer<typeof closeShiftFormSchema>;

/**
 * No live expected-cash preview — the backend computes `expectedCash`/`variance` synchronously in
 * the close response, so we just show the counted-cash input, submit, then render the result.
 */
export function CloseShiftDialog({
  open,
  onOpenChange,
  shift,
  currencySymbol,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: ShiftRecord;
  currencySymbol: string;
}) {
  const closeShift = useCloseShift();
  const [result, setResult] = useState<ShiftRecord | null>(null);

  const form = useForm<CloseShiftFormValues>({
    resolver: zodResolver(closeShiftFormSchema),
    defaultValues: { closingCountedCash: 0 },
  });

  function handleOpenChange(next: boolean) {
    if (next) {
      form.reset({ closingCountedCash: 0 });
      setResult(null);
    }
    onOpenChange(next);
  }

  async function onSubmit(values: CloseShiftFormValues) {
    try {
      const closed = await closeShift.mutateAsync({
        id: shift._id,
        dto: { closingCountedCash: toMoneyCents(values.closingCountedCash) },
      });
      setResult(closed);
      toast.success("Shift closed.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Something went wrong.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close shift {shift.shiftNo}</DialogTitle>
          <DialogDescription>Count the cash drawer and enter the total.</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Expected cash</span>
              <span>{formatMoneyCents(result.expectedCash ?? 0, currencySymbol)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Counted cash</span>
              <span>{formatMoneyCents(result.closingCountedCash ?? 0, currencySymbol)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Variance</span>
              <span className={(result.variance ?? 0) !== 0 ? "text-red-600" : ""}>
                {formatMoneyCents(result.variance ?? 0, currencySymbol)}
              </span>
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="closingCountedCash"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Counted cash</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={closeShift.isPending}>
                  {closeShift.isPending ? "Closing…" : "Close shift"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
