"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toMoneyCents } from "@onepos/shared-types";
import { toast } from "sonner";

import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="mx-auto max-w-sm pt-12">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <LockKeyhole className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Open shift</h1>
          <p className="text-sm text-slate-500">
            Enter the starting cash float to begin selling on this terminal.
          </p>
        </div>
      </div>
      <Card className="shadow-md">
        <CardContent className="p-6">
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
              <Button type="submit" size="lg" className="w-full" disabled={openShift.isPending}>
                {openShift.isPending ? "Opening…" : "Open shift"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
