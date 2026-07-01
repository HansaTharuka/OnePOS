"use client";

import { useRouter } from "next/navigation";
import { formatMoneyCents } from "@onepos/shared-types";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDeleteParkedSale, useParkedSales } from "@/lib/queries/sales";
import { usePublicSettings } from "@/lib/queries/settings";
import { ApiError } from "@/lib/api/error";

export default function ParkedSalesPage() {
  const router = useRouter();
  const { data: parkedSales, isLoading } = useParkedSales();
  const { data: settings } = usePublicSettings();
  const deleteParkedSale = useDeleteParkedSale();
  const currencySymbol = settings?.currencySymbol ?? "$";

  async function handleDiscard(id: string) {
    if (!window.confirm("Discard this parked sale? This cannot be undone.")) return;
    try {
      await deleteParkedSale.mutateAsync(id);
      toast.success("Parked sale discarded.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Something went wrong.");
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-zinc-900">Parked sales</h1>

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Lines</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="w-56"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(parkedSales ?? [])
              .slice()
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((sale) => (
                <TableRow key={sale._id}>
                  <TableCell className="font-medium">{sale.orderNo}</TableCell>
                  <TableCell className="text-zinc-500">
                    {new Date(sale.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>{sale.lines.length}</TableCell>
                  <TableCell>{formatMoneyCents(sale.grandTotal, currencySymbol)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" onClick={() => router.push(`/pos?resume=${sale._id}`)}>
                        Resume
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={deleteParkedSale.isPending}
                        onClick={() => void handleDiscard(sale._id)}
                      >
                        Discard
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {(parkedSales ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-sm text-zinc-500">
                  No parked sales.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
