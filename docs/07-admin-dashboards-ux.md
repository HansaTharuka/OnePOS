# Admin Features, Reporting Dashboards & Cashier UX

## Admin panel (Next.js, role-gated)

- User/role management (see [`03-rbac-permissions.md`](./03-rbac-permissions.md))
- Settings — branding (name/logo), tax rules, currency, receipt/invoice templates, feature flags
  (see [`04-configuration.md`](./04-configuration.md))
- Printer configuration per terminal (see [`06-printer-integration.md`](./06-printer-integration.md))
- Product / category / brand / supplier management
- Purchase order and goods-received-note workflow
- Audit log viewer (filterable by actor, action, date range)
- DB connection management (bootstrap-level, Super Admin only)

## Sales-summary dashboard widgets, ranked by daily usefulness

1. **Daily sales summary** (revenue, transaction count, avg basket size) vs. prior day/week
2. **Low-stock / reorder alerts** — qty below reorderPoint, sorted by sales velocity
3. **Top-selling items** — by qty *and* by margin separately (these often diverge: cheap
   fasteners sell high volume, power tools carry the margin)
4. **Slow-moving / dead stock** — no sale in N days, for markdown decisions
5. **Profit margin by category/brand**
6. **Shift/till reconciliation variance** — expected vs. counted cash, flagged over a threshold
7. **Cashier performance** — sales/hour, avg transaction time, void/discount rate (also a fraud
   signal — an unusually high void rate on one cashier is worth investigating)
8. **Supplier PO status** — open POs, overdue deliveries, GRN discrepancies
9. **Customer credit aging** — outstanding trade-account balances, overdue accounts
10. **Returns/void rate trend** — by item and by cashier, surfaces process or quality issues

## Cashier UX principles (drives "very user friendly")

- **Barcode-scanner-as-keyboard-input**: scanner output auto-focuses a hidden input field and is
  treated as keyboard input (suffix `\n`) — no mouse click needed to "start" a sale.
- **Full keyboard-shortcut coverage**: F-keys or Alt+letter for Pay/Void/Discount/Park-Sale/
  Customer-lookup; Enter always confirms the default action; Esc always cancels the current line,
  not the whole sale.
- **Quick manual entry** for non-barcoded/bulk items: `qty*sku` pattern (e.g. `5*1234` for five of
  a loose-screw SKU); a touch-grid search-by-name/category as a secondary fallback.
- **Inline manager-PIN approval** for price override, large discount, no-sale, or void-after-
  payment — a modal that keeps the cashier's session and basket intact, rather than logging them
  out to re-authenticate as a manager.
- **Item-not-found never hard-blocks a sale** — allow manual price entry with a mandatory reason
  code, flagged for manager review afterward.
- **Split/partial payment**: multiple payment lines within one sale (cash + card), with a
  prominent running "amount remaining."
- **Void line vs. void sale**: voiding one line must not require re-entering the whole basket.
- **Park/hold sale**: a cashier can suspend and resume a sale later (customer forgot their wallet)
  without losing the basket.
- **Large touch targets** (~48px minimum) when running on a touchscreen, but always keep the
  keyboard-shortcut path in parallel — power users abandon touch-only UIs at a busy till.
- Always show the **running total and change-due** in large font, visible to the cashier and
  ideally on a customer-facing display.
