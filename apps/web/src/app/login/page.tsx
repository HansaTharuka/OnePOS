import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSetupStatus } from "@/lib/setup-status";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const { needsSetup } = await getSetupStatus();
  if (needsSetup) redirect("/setup");

  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
