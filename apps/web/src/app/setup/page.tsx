import { redirect } from "next/navigation";
import { getSetupStatus } from "@/lib/setup-status";
import { SetupForm } from "./setup-form";

export default async function SetupPage() {
  const { needsSetup } = await getSetupStatus();
  if (!needsSetup) redirect("/login");

  return <SetupForm />;
}
