"use client";

import { use, useState } from "react";
import { formatMoneyCents } from "@onepos/shared-types";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ManagerPinDialog } from "@/components/manager-pin-dialog";
import { useReceipt, useSale, useVoidSale } from "@/lib/queries/sales";

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  completed: "success",
  parked: "warning",
  voided: "destructive",
};

export default function SaleReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: receipt, isLoading, isError } = useReceipt(id);
  const { data: sale } = useSale(id);
  const voidSale = useVoidSale();
  const [voidOpen, setVoidOpen] = useState(false);

  async function handleVoidSubmit(pin: string, reason?: string) {
    await voidSale.mutateAsync({ id, dto: { managerPin: pin, reason: reason ?? "" } });
    toast.success("Sale voided.");
  }

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (isError || !receipt) return <p className="text-sm text-destructive">Receipt not found.</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Receipt {receipt.orderNo}</h1>
          {sale && <Badge variant={STATUS_VARIANT[sale.status] ?? "secondary"}>{sale.status}</Badge>}
        </div>
        <div className="flex gap-2">
          {sale?.status === "completed" && (
            <Button variant="destructive" onClick={() => setVoidOpen(true)}>
              Void sale
            </Button>
          )}
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      <Card className="mx-auto max-w-sm shadow-md">
        <div className="p-6 font-mono text-sm">
          <div className="mb-4 text-center">
            <div className="text-base font-semibold text-slate-900">{receipt.businessName}</div>
            <div className="text-slate-500">{new Date(receipt.createdAt).toLocaleString()}</div>
            <div className="text-slate-500">Order {receipt.orderNo}</div>
          </div>

          <div className="mb-4 space-y-1 border-y border-dashed border-slate-300 py-2">
            {receipt.lines.map((line, i) => (
              <div key={i} className="flex justify-between">
                <span>
                  {line.qty} {line.uom} × {formatMoneyCents(line.unitPrice, receipt.currencySymbol)}
                </span>
                <span className="tabular-money">{formatMoneyCents(line.lineTotal, receipt.currencySymbol)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="tabular-money">{formatMoneyCents(receipt.subtotal, receipt.currencySymbol)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <span className="tabular-money">{formatMoneyCents(receipt.taxTotal, receipt.currencySymbol)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-semibold">
              <span>Total</span>
              <span className="tabular-money">{formatMoneyCents(receipt.grandTotal, receipt.currencySymbol)}</span>
            </div>
            {receipt.payments.map((payment, i) => (
              <div key={i} className="flex justify-between">
                <span className="capitalize">
                  {payment.method}
                  {payment.reference ? ` (${payment.reference})` : ""}
                </span>
                <span className="tabular-money">{formatMoneyCents(payment.amount, receipt.currencySymbol)}</span>
              </div>
            ))}
            <div className="flex justify-between">
              <span>Change</span>
              <span className="tabular-money">{formatMoneyCents(receipt.changeGiven, receipt.currencySymbol)}</span>
            </div>
          </div>

          {receipt.receiptFooterText && (
            <div className="mt-4 text-center text-slate-500">{receipt.receiptFooterText}</div>
          )}
        </div>
      </Card>

      <ManagerPinDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        title="Void sale"
        description="Voiding reverses this sale's stock and payment effects. Manager approval is required."
        requireReason
        onSubmit={handleVoidSubmit}
      />
    </div>
  );
}
