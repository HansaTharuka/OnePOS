"use client";

import { use, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CASH_DRAWER_MOVEMENT_TYPES, formatMoneyCents, toMoneyCents } from "@onepos/shared-types";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { ManagerPinDialog } from "@/components/manager-pin-dialog";
import { useCashMovements, useRecordCashMovement, useShift } from "@/lib/queries/shifts";
import { usePublicSettings } from "@/lib/queries/settings";
import { ApiError } from "@/lib/api/error";

// The recorder can only create paid-in/paid-out/drop movements — "opening" is system-created when
// the shift is opened and only ever appears in the ledger below.
const RECORDABLE_MOVEMENT_TYPES = CASH_DRAWER_MOVEMENT_TYPES.filter((t) => t !== "opening");

const movementFormSchema = z.object({
  type: z.enum(["paid-in", "paid-out", "drop"]),
  amount: z.coerce.number().positive("Must be positive"),
  reason: z.string().min(1, "Required"),
});
type MovementFormValues = z.infer<typeof movementFormSchema>;

export default function ShiftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: shift, isLoading } = useShift(id);
  const { data: movements } = useCashMovements(id);
  const { data: settings } = usePublicSettings();
  const recordMovement = useRecordCashMovement();
  const currencySymbol = settings?.currencySymbol ?? "$";

  const [pinOpen, setPinOpen] = useState(false);

  const form = useForm<MovementFormValues>({
    resolver: zodResolver(movementFormSchema),
    defaultValues: { type: "paid-in", amount: 0, reason: "" },
  });

  // Shared by the direct paid-in submit and the manager-PIN retry for paid-out/drop.
  async function submitMovement(values: MovementFormValues, managerPin?: string) {
    await recordMovement.mutateAsync({
      shiftId: id,
      dto: {
        type: values.type,
        amount: toMoneyCents(values.amount),
        reason: values.reason,
        managerPin,
      },
    });
    toast.success("Cash movement recorded.");
    form.reset({ type: "paid-in", amount: 0, reason: "" });
  }

  async function onSubmit(values: MovementFormValues) {
    if (values.type === "paid-out" || values.type === "drop") {
      setPinOpen(true);
      return;
    }
    try {
      await submitMovement(values);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Something went wrong.");
    }
  }

  // The reason is already collected on the form above, so the PIN dialog only needs the PIN.
  async function handlePinSubmit(pin: string) {
    await submitMovement(form.getValues(), pin);
  }

  if (isLoading || !shift) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Shift {shift.shiftNo}</h1>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>Terminal {shift.terminalId}</span>
          <Badge variant={shift.status === "open" ? "info" : "secondary"}>{shift.status}</Badge>
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-5 text-sm sm:grid-cols-4">
        <div>
          <div className="text-slate-500">Opening float</div>
          <div className="tabular-money font-medium text-slate-900">
            {formatMoneyCents(shift.openingFloat, currencySymbol)}
          </div>
        </div>
        <div>
          <div className="text-slate-500">Expected cash</div>
          <div className="tabular-money font-medium text-slate-900">
            {shift.expectedCash !== undefined ? formatMoneyCents(shift.expectedCash, currencySymbol) : "—"}
          </div>
        </div>
        <div>
          <div className="text-slate-500">Counted cash</div>
          <div className="tabular-money font-medium text-slate-900">
            {shift.closingCountedCash !== undefined
              ? formatMoneyCents(shift.closingCountedCash, currencySymbol)
              : "—"}
          </div>
        </div>
        <div>
          <div className="text-slate-500">Variance</div>
          <div
            className={`tabular-money font-medium ${
              shift.variance ? (shift.variance > 0 ? "text-amber-600" : "text-destructive") : "text-slate-900"
            }`}
          >
            {shift.variance !== undefined ? formatMoneyCents(shift.variance, currencySymbol) : "—"}
          </div>
        </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Cash drawer movements</h2>
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Recorded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(movements ?? []).map((movement) => (
                <TableRow key={movement._id}>
                  <TableCell className="capitalize">{movement.type}</TableCell>
                  <TableCell className="tabular-money">
                    {formatMoneyCents(movement.amount, currencySymbol)}
                  </TableCell>
                  <TableCell className="text-slate-500">{movement.reason ?? "—"}</TableCell>
                  <TableCell className="text-slate-500">
                    {new Date(movement.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {(movements ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-slate-500">
                    No cash movements yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {shift.status === "open" && (
        <Card className="max-w-md">
          <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Record cash movement</h2>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RECORDABLE_MOVEMENT_TYPES.map((type) => (
                          <SelectItem key={type} value={type} className="capitalize">
                            {type}
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
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Amount</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Reason</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={recordMovement.isPending}>
                {recordMovement.isPending ? "Recording…" : "Record"}
              </Button>
            </form>
          </Form>
          </CardContent>
        </Card>
      )}

      <ManagerPinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        title="Manager approval required"
        description="Paid-out and cash-drop movements require manager PIN approval."
        onSubmit={handlePinSubmit}
      />
    </div>
  );
}
