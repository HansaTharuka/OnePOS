"use client";

import Link from "next/link";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGrns } from "@/lib/queries/grn";

export default function GoodsReceivedPage() {
  const { data: grns, isLoading } = useGrns();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Goods Received Notes</h1>
          <p className="text-sm text-slate-500">Stock-in history from suppliers.</p>
        </div>
        <Button asChild>
          <Link href="/goods-received/new">Receive stock</Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GRN #</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead>Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(grns ?? [])
                .slice()
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((grn) => (
                  <TableRow key={grn._id}>
                    <TableCell className="font-medium text-slate-900">{grn.grnNumber}</TableCell>
                    <TableCell className="text-slate-500">{grn.branchId}</TableCell>
                    <TableCell>{grn.lines.length}</TableCell>
                    <TableCell className="text-slate-500">
                      {new Date(grn.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              {(grns ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Truck className="h-8 w-8" />
                      <span className="text-sm">No goods received notes yet.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
