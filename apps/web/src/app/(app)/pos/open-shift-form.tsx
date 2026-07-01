"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toMoneyCents } from "@onepos/shared-types";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useOpenShift } from "@/lib/queries/shifts";
import { ApiError } from "@/lib/api/error";

const openShiftFormSchema = z.object({
  openingFloat: z.coerce.number().nonnegative("Must be 0 or more"),
});
type OpenShiftFormValues = z.infer<typeof openShiftFormSchema>;

/**
 * Gates the POS screen: a cashier cannot ring up sales without an open shift on this terminal
 * (see `pos/page.tsx`, which renders this instead of the cart whenever `useCurrentShift` is null).
 */
export function OpenShiftForm({ terminalId }: { terminalId: string }) {
  const openShift = useOpenShift();

  const form = useForm<OpenShiftFormValues>({
    resolver: zodResolver(openShiftFormSchema),
    defaultValues: { openingFloat: 0 },
  });

  async function onSubmit(values: OpenShiftFormValues) {
    try {
      await openShift.mutateAsync({
        terminalId,
        branchId: "main",
        openingFloat: toMoneyCents(values.openingFloat),
      });
      toast.success("Shift opened.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Something went wrong.");
    }
  }

  return (
    <div className="mx-auto max-w-sm rounded-lg border border-zinc-200 p-6">
      <h1 className="mb-1 text-xl font-semibold text-zinc-900">Open shift</h1>
      <p className="mb-4 text-sm text-zinc-500">
        Enter the starting cash float to begin selling on this terminal.
      </p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="openingFloat"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Opening float</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" autoFocus {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={openShift.isPending}>
            {openShift.isPending ? "Opening…" : "Open shift"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
