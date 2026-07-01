"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogoutButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      // Every cached query (products, sales, shifts, ...) is scoped to the session that fetched
      // it — none of it may be reused by whichever user logs in next in this same tab.
      queryClient.clear();
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (iconOnly) {
    return (
      <Button
        variant="outline"
        size="icon"
        title="Sign out"
        onClick={handleLogout}
        disabled={loading}
      >
        <LogOut className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" className="w-full justify-center" onClick={handleLogout} disabled={loading}>
      <LogOut className="h-4 w-4" />
      {loading ? "Signing out…" : "Sign out"}
    </Button>
  );
}
