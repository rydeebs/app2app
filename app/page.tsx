import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { AppGrid } from "@/components/AppGrid";

export default async function Hub() {
  const supabase = await createClient();

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Auth/network failure — send to login rather than crashing the render.
    redirect("/login");
  }
  if (!user) redirect("/login");

  const { data: apps } = await supabase
    .from("apps")
    .select("id, name, icon, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif-italic text-3xl text-foreground">Your apps</h1>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
        <SignOutButton />
      </div>

      <Link
        href="/create"
        className="mb-6 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/50 bg-primary/5 px-4 py-4 font-medium text-primary"
      >
        + Build a new app from a plan
      </Link>

      <AppGrid apps={apps ?? []} />

      <div className="mt-10 flex justify-end border-t border-border pt-4">
        <DeleteAccountButton />
      </div>
    </main>
  );
}
