"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Store } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/layout/logout-button";
import { MainNav } from "@/components/layout/main-nav";
import { cn } from "@/lib/utils";
import type { NavKey } from "@/lib/permissions";

const COLLAPSE_STORAGE_KEY = "onepos_sidebar_collapsed";

export function AppShell({
  businessName,
  userName,
  roleName,
  navKeys,
  children,
}: {
  businessName: string;
  userName: string;
  roleName: string;
  navKeys: NavKey[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // One-time sync from an external source (localStorage) into local state on mount, not a value
  // re-derivable from render — same pattern/justification as the parked-sale resume effect in
  // pos/page.tsx.
  useEffect(() => {
    const stored = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "1") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  const isFullBleed = pathname.startsWith("/pos");

  return (
    <div className="flex min-h-full flex-1">
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-150 print:hidden",
          collapsed ? "w-[72px]" : "w-[240px]",
        )}
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-slate-100 px-3",
            collapsed ? "justify-center" : "justify-between",
          )}
        >
          {!collapsed && (
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Store className="h-4 w-4" />
              </span>
              <span className="truncate text-sm font-semibold text-slate-900">{businessName}</span>
            </div>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <MainNav navKeys={navKeys} collapsed={collapsed} />

        <div className="shrink-0 border-t border-slate-100 p-3">
          {!collapsed && (
            <div className="mb-2 min-w-0">
              <div className="truncate text-sm font-medium text-slate-900">{userName}</div>
              <Badge variant="info" className="mt-1">
                {roleName}
              </Badge>
            </div>
          )}
          <div className={collapsed ? "flex justify-center" : ""}>
            <LogoutButton iconOnly={collapsed} />
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className={cn("mx-auto w-full px-4 py-6 md:px-8", isFullBleed ? "max-w-[1600px]" : "max-w-7xl")}>
          {children}
        </div>
      </main>
    </div>
  );
}
