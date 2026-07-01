import {
  ShoppingCart,
  Package,
  Tags,
  BadgeCheck,
  Boxes,
  Truck,
  Receipt,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { SystemRole } from "@onepos/shared-types";

export type NavGroup = "Sell" | "Catalog" | "Operations";

export interface NavItem {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  group: NavGroup;
}

export const NAV_ITEMS = {
  pos: { key: "pos", href: "/pos", label: "POS", icon: ShoppingCart, group: "Sell" },
  products: { key: "products", href: "/products", label: "Products", icon: Package, group: "Catalog" },
  categories: { key: "categories", href: "/categories", label: "Categories", icon: Tags, group: "Catalog" },
  brands: { key: "brands", href: "/brands", label: "Brands", icon: BadgeCheck, group: "Catalog" },
  inventory: { key: "inventory", href: "/inventory", label: "Inventory", icon: Boxes, group: "Operations" },
  grn: { key: "grn", href: "/goods-received", label: "Goods Received", icon: Truck, group: "Operations" },
  sales: { key: "sales", href: "/sales", label: "Sales", icon: Receipt, group: "Operations" },
  shifts: { key: "shifts", href: "/shifts", label: "Shifts", icon: Clock, group: "Operations" },
} as const satisfies Record<string, NavItem>;

export type NavKey = keyof typeof NAV_ITEMS;

/**
 * Cosmetic nav filtering only — mirrors the rules in apps/api/src/modules/roles/roles.seed.ts.
 * NOT a security boundary; the API's CaslAbilityGuard is the real enforcement. There is no
 * `/auth/me`-style ability endpoint yet (see docs/09-implementation-status.md gap), so this maps
 * roleName -> visible nav sections by hand rather than resolving real CASL rules client-side.
 */
const ROLE_NAV_KEYS: Record<SystemRole, NavKey[]> = {
  [SystemRole.SUPER_ADMIN]: [
    "pos",
    "products",
    "categories",
    "brands",
    "inventory",
    "grn",
    "sales",
    "shifts",
  ],
  [SystemRole.ADMIN]: ["pos", "products", "categories", "brands", "inventory", "grn", "sales", "shifts"],
  [SystemRole.MANAGER]: ["pos", "products", "categories", "brands", "inventory", "grn", "sales", "shifts"],
  [SystemRole.CASHIER]: ["pos", "inventory", "sales", "shifts"],
  [SystemRole.INVENTORY_CLERK]: ["products", "categories", "brands", "inventory", "grn"],
  [SystemRole.ACCOUNTANT]: ["sales"],
};

// Returns keys, not resolved NavItem objects: NavItem.icon is a component reference, which
// can't cross the server->client prop boundary (this is computed in a Server Component and
// consumed by the client AppShell/MainNav, which resolve keys back to NAV_ITEMS themselves).
export function getNavKeysForRole(roleName: string): NavKey[] {
  return ROLE_NAV_KEYS[roleName as SystemRole] ?? [];
}
