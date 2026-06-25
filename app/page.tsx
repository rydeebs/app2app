import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";

export default async function Hub() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

      {!apps?.length ? (
        <p className="text-center text-sm text-muted">
          No apps yet. Paste a plan to create your first one.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {apps.map((app) => {
            const icon = app.icon as { emoji?: string; color?: string };
            return (
              <li key={app.id}>
                <Link
                  href={`/a/${app.id}`}
                  className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:border-primary/40"
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                    style={{ background: (icon.color || "#9b86d4") + "22" }}
                  >
                    {icon.emoji || "📦"}
                  </span>
                  <span className="font-medium text-foreground">{app.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-10 flex justify-end border-t border-border pt-4">
        <DeleteAccountButton />
      </div>
    </main>
  );
}
