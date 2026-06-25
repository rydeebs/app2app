"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await createClient().auth.signOut();
        router.push("/login");
        router.refresh();
      }}
      className="rounded-xl border border-border px-3 py-1.5 text-sm text-muted transition hover:text-foreground"
    >
      Sign out
    </button>
  );
}
