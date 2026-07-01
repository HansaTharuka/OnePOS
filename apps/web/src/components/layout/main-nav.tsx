"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, type NavGroup, type NavKey } from "@/lib/permissions";

const GROUP_ORDER: NavGroup[] = ["Sell", "Catalog", "Operations"];

export function MainNav({ navKeys, collapsed }: { navKeys: NavKey[]; collapsed: boolean }) {
  const pathname = usePathname();
  const items = navKeys.map((key) => NAV_ITEMS[key]);

  const groups = GROUP_ORDER.map((group) => ({
    group,
    items: items.filter((item) => item.group === group),
  })).filter((g) => g.items.length > 0);

  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 py-2">
      {groups.map(({ group, items: groupItems }) => (
        <div key={group}>
          {!collapsed && (
            <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {group}
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            {groupItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                    collapsed && "justify-center",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
