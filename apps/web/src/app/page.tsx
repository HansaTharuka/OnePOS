import { getPublicSettings } from "@/lib/settings";

export default async function Home() {
  const settings = await getPublicSettings();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 font-sans dark:bg-black">
      <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
        {settings?.businessName ?? "OnePOS"}
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        {settings
          ? `Connected to API — currency ${settings.currencyCode} (${settings.currencySymbol})`
          : "API not reachable yet — start apps/api and refresh."}
      </p>
    </div>
  );
}
