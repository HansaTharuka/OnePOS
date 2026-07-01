import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPublicSettings } from "@/lib/settings";
import { getNavKeysForRole } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [settings] = await Promise.all([getPublicSettings()]);
  const navKeys = getNavKeysForRole(session.user.roleName);

  return (
    <AppShell
      businessName={settings?.businessName ?? "OnePOS"}
      userName={session.user.name}
      roleName={session.user.roleName}
      navKeys={navKeys}
    >
      {children}
    </AppShell>
  );
}
