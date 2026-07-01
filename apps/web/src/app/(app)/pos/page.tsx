"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatMoneyCents } from "@onepos/shared-types";
import { toast } from "sonner";
import { Minus, Plus, ScanBarcode, ShoppingCart, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProducts } from "@/lib/queries/products";
import { usePublicSettings } from "@/lib/queries/settings";
import { useCurrentShift } from "@/lib/queries/shifts";
import { useDeleteParkedSale, useParkedSales, useParkSale } from "@/lib/queries/sales";
import { useTerminalId } from "@/lib/terminal";
import { ApiError } from "@/lib/api/error";
import {
  cartLinesFromParkedSale,
  computeTotals,
  matchProduct,
  newIdempotencyKey,
  parseScanInput,
  type CartLine,
} from "@/lib/pos/cart";
import { CheckoutDialog } from "./checkout-dialog";
import { OpenShiftForm } from "./open-shift-form";
import { CloseShiftDialog } from "./close-shift-dialog";

function PosScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const terminalId = useTerminalId();
  const { data: products } = useProducts();
  const { data: settings } = usePublicSettings();
  const { data: currentShift, isLoading: shiftLoading } = useCurrentShift(terminalId);
  const { data: parkedSales } = useParkedSales();
  const parkSale = useParkSale();
  const deleteParkedSale = useDeleteParkedSale();

  const [cart, setCart] = useState<CartLine[]>([]);
  const [scanValue, setScanValue] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [closeShiftOpen, setCloseShiftOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => newIdempotencyKey());
  const [resumedFromParkedId, setResumedFromParkedId] = useState<string | undefined>(undefined);
  const scanInputRef = useRef<HTMLInputElement>(null);

  const currencySymbol = settings?.currencySymbol ?? "$";
  const taxRatePercent = settings?.defaultTaxRatePercent ?? 0;
  const totals = useMemo(() => computeTotals(cart, taxRatePercent), [cart, taxRatePercent]);

  // Resume a parked sale referenced by ?resume=<id> once both the parked-sales list and the
  // product catalog (needed to rebuild display fields) have loaded. This is a one-time sync from
  // an external source (the URL) into local cart state, not a value re-derivable from render, so
  // it deliberately lives in an effect rather than being computed inline.
  useEffect(() => {
    const resumeId = searchParams.get("resume");
    if (!resumeId || !products || !parkedSales) return;
    const parked = parkedSales.find((s) => s._id === resumeId);
    if (!parked) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCart(cartLinesFromParkedSale(parked.lines, products));
    setResumedFromParkedId(resumeId);
    router.replace("/pos");
  }, [searchParams, products, parkedSales, router]);

  // Focus the scanner input on mount, and again once the checkout dialog closes — but never
  // steal focus away from other controls (cart qty/discount fields, the dialog itself) the way
  // an unconditional onBlur-refocus would.
  useEffect(() => {
    if (!checkoutOpen) scanInputRef.current?.focus();
  }, [checkoutOpen]);

  async function handleParkSale() {
    if (cart.length === 0 || !currentShift || !terminalId) return;
    try {
      const parked = await parkSale.mutateAsync({
        terminalId,
        shiftId: currentShift._id,
        lines: cart.map((line) => ({
          productId: line.productId,
          uom: line.uom,
          qty: line.qty,
          discount: line.discount,
        })),
      });
      toast.success(`Sale parked as ${parked.orderNo}.`);
      setCart([]);
      setResumedFromParkedId(undefined);
      setIdempotencyKey(newIdempotencyKey());
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Something went wrong.");
    }
  }

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        if (cart.length > 0) setCheckoutOpen(true);
      } else if (e.key === "F4") {
        e.preventDefault();
        if (cart.length > 0 && window.confirm("Clear the current sale?")) {
          setCart([]);
        }
      } else if (e.key === "F6") {
        e.preventDefault();
        void handleParkSale();
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, currentShift, terminalId]);

  function addToCart(productId: string, uom: string, qty: number) {
    const product = (products ?? []).find((p) => p._id === productId);
    if (!product) return;
    const uomEntry = product.unitsOfMeasure.find((u) => u.uom === uom);
    if (!uomEntry) return;

    setCart((prev) => {
      const existingIndex = prev.findIndex((l) => l.productId === productId && l.uom === uom);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = { ...next[existingIndex], qty: next[existingIndex].qty + qty };
        return next;
      }
      return [
        ...prev,
        {
          key: `${productId}:${uom}`,
          productId,
          sku: product.sku,
          name: product.name,
          uom,
          unitPrice: uomEntry.sellPrice,
          isTaxable: product.isTaxable,
          qty,
          discount: 0,
        },
      ];
    });
  }

  function handleScanSubmit() {
    const { qty, term } = parseScanInput(scanValue);
    setScanValue("");
    if (!term) return;

    const match = matchProduct(products ?? [], term);
    if (!match) {
      toast.error(`No product found for "${term}".`);
      return;
    }
    addToCart(match.product._id, match.uom, qty);
  }

  function updateLineQty(key: string, qty: number) {
    if (qty <= 0) return;
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, qty } : l)));
  }

  function updateLineDiscount(key: string, discountDollars: number) {
    const cents = Math.max(0, Math.round(discountDollars * 100));
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, discount: cents } : l)));
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  function handleSaleSuccess(saleId: string) {
    if (resumedFromParkedId) {
      // Fire-and-forget: don't block/fail the checkout success on cleaning up the parked record.
      deleteParkedSale.mutate(resumedFromParkedId);
    }
    setCart([]);
    setCheckoutOpen(false);
    setIdempotencyKey(newIdempotencyKey());
    setResumedFromParkedId(undefined);
    router.push(`/sales/${saleId}`);
  }

  if (shiftLoading || !terminalId) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (!currentShift) {
    return <OpenShiftForm terminalId={terminalId} />;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">POS Terminal</h1>
          <Badge variant="info">Shift {currentShift.shiftNo}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/parked-sales")}>
            Parked sales{parkedSales && parkedSales.length > 0 ? ` (${parkedSales.length})` : ""}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCloseShiftOpen(true)}>
            Close shift
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="relative mb-4">
            <ScanBarcode className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
            <Input
              ref={scanInputRef}
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleScanSubmit();
                } else if (e.key === "Escape") {
                  setScanValue("");
                }
              }}
              placeholder="Scan barcode, type SKU, or qty*sku (e.g. 5*1234), then Enter"
              className="h-14 border-2 border-slate-200 pl-12 text-base shadow-sm focus-visible:border-primary"
              autoFocus
            />
          </div>

          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead className="w-36">Qty</TableHead>
                  <TableHead>Unit price</TableHead>
                  <TableHead className="w-28">Discount</TableHead>
                  <TableHead>Line total</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.map((line) => (
                  <TableRow key={line.key}>
                    <TableCell>
                      <div className="font-medium text-slate-900">{line.name}</div>
                      <div className="font-mono text-xs text-slate-400">{line.sku}</div>
                    </TableCell>
                    <TableCell className="text-slate-500">{line.uom}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => updateLineQty(line.key, line.qty - 1)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <Input
                          type="number"
                          step="any"
                          value={line.qty}
                          onChange={(e) => updateLineQty(line.key, Number(e.target.value))}
                          className="h-8 w-14 px-1 text-center tabular-money"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => updateLineQty(line.key, line.qty + 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-money">
                      {formatMoneyCents(line.unitPrice, currencySymbol)}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={line.discount / 100}
                        onChange={(e) => updateLineDiscount(line.key, Number(e.target.value))}
                        className="h-8 tabular-money"
                      />
                    </TableCell>
                    <TableCell className="tabular-money font-semibold text-slate-900">
                      {formatMoneyCents(line.unitPrice * line.qty - line.discount, currencySymbol)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeLine(line.key)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {cart.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <ShoppingCart className="h-8 w-8" />
                        <span className="text-sm">Scan or search for an item to start a sale.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          <div className="mt-6">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Browse products
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {(products ?? [])
                .filter((p) => p.isActive)
                .slice(0, 12)
                .map((product) => {
                  const base = product.unitsOfMeasure.find((u) => u.isBaseUnit);
                  if (!base) return null;
                  return (
                    <button
                      key={product._id}
                      type="button"
                      onClick={() => addToCart(product._id, base.uom, 1)}
                      className="rounded-lg border border-slate-200 bg-white p-3 text-left text-sm shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                    >
                      <div className="font-medium text-slate-900">{product.name}</div>
                      <div className="tabular-money text-primary">
                        {formatMoneyCents(base.sellPrice, currencySymbol)}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        <div className="col-span-1">
          <Card className="sticky top-6 shadow-md">
            <CardContent className="p-5">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="tabular-money">{formatMoneyCents(totals.subtotal, currencySymbol)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tax</span>
                  <span className="tabular-money">{formatMoneyCents(totals.taxTotal, currencySymbol)}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-slate-100 pt-2">
                  <span className="text-base font-semibold text-slate-900">Total</span>
                  <span className="tabular-money text-3xl font-bold text-slate-900">
                    {formatMoneyCents(totals.grandTotal, currencySymbol)}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <Button
                  variant="success"
                  size="xl"
                  className="w-full"
                  disabled={cart.length === 0}
                  onClick={() => setCheckoutOpen(true)}
                >
                  Pay
                  <kbd className="ml-1 rounded bg-white/20 px-1.5 py-0.5 text-xs font-medium">F2</kbd>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  disabled={cart.length === 0}
                  onClick={() => void handleParkSale()}
                >
                  Park sale
                  <kbd className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                    F6
                  </kbd>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  disabled={cart.length === 0}
                  onClick={() => {
                    if (window.confirm("Clear the current sale?")) setCart([]);
                  }}
                >
                  Clear sale
                  <kbd className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                    F4
                  </kbd>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        lines={cart}
        taxRatePercent={taxRatePercent}
        currencySymbol={currencySymbol}
        idempotencyKey={idempotencyKey}
        terminalId={terminalId}
        shiftId={currentShift._id}
        resumedFromParkedId={resumedFromParkedId}
        onSuccess={handleSaleSuccess}
      />

      <CloseShiftDialog
        open={closeShiftOpen}
        onOpenChange={setCloseShiftOpen}
        shift={currentShift}
        currencySymbol={currencySymbol}
      />
    </div>
  );
}

export default function PosPage() {
  return (
    <Suspense fallback={null}>
      <PosScreen />
    </Suspense>
  );
}
