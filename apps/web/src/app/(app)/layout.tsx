import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPublicSettings } from "@/lib/settings";
import { getNavItemsForRole } from "@/lib/permissions";
import { MainNav } from "@/components/layout/main-nav";
import { LogoutButton } from "@/components/layout/logout-button";
import { Badge } from "@/components/ui/badge";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [settings] = await Promise.all([getPublicSettings()]);
  const navItems = getNavItemsForRole(session.user.roleName);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-lg font-semibold text-zinc-900">
              {settings?.businessName ?? "OnePOS"}
            </span>
            <MainNav items={navItems} />
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm leading-tight">
              <div className="font-medium text-zinc-900">{session.user.name}</div>
              <Badge variant="secondary" className="mt-0.5">
                {session.user.roleName}
              </Badge>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
