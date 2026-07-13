"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type AppCard = {
  id: string;
  name: string;
  icon: unknown;
  created_at: string;
};

export function AppGrid({ apps: initialApps }: { apps: AppCard[] }) {
  const [apps, setApps] = useState(initialApps);
  const [editMode, setEditMode] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function remove(app: AppCard) {
    if (busyId) return;
    if (!window.confirm(`Delete "${app.name}"? This removes the app and its saved progress.`)) {
      return;
    }
    setBusyId(app.id);
    const supabase = createClient();
    const { error } = await supabase.from("apps").delete().eq("id", app.id);
    setBusyId(null);
    if (error) {
      window.alert("Could not delete this app. Please try again.");
      return;
    }
    setApps((prev) => {
      const next = prev.filter((a) => a.id !== app.id);
      if (next.length === 0) setEditMode(false);
      return next;
    });
  }

  if (!apps.length) {
    return (
      <p className="text-center text-sm text-muted">
        No apps yet. Paste a plan to create your first one.
      </p>
    );
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-sm text-muted">{editMode ? "Tap ✕ to delete an app" : ""}</span>
        <button
          onClick={() => setEditMode((v) => !v)}
          className={
            editMode
              ? "rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-ink"
              : "rounded-full border border-border px-4 py-1.5 text-sm font-medium text-muted transition hover:text-foreground"
          }
        >
          {editMode ? "Done" : "Remove app"}
        </button>
      </div>

      <ul className="grid grid-cols-2 gap-3">
        {apps.map((app) => {
          const icon = (app.icon ?? {}) as { emoji?: string; color?: string };
          const busy = busyId === app.id;
          return (
            <li key={app.id} className="relative">
              {editMode ? (
                <button
                  onClick={() => remove(app)}
                  disabled={busy}
                  aria-label={`Delete ${app.name}`}
                  className="absolute -left-1.5 -top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-foreground text-sm text-background shadow-md disabled:opacity-50"
                >
                  {busy ? "…" : "✕"}
                </button>
              ) : null}
              <Link
                href={`/a/${app.id}`}
                onClick={(e) => {
                  if (editMode) e.preventDefault();
                }}
                onContextMenu={(e) => e.preventDefault()}
                // Suppress the iOS long-press link preview (the "Vercel page" popup).
                style={{ WebkitTouchCallout: "none" }}
                className={
                  "flex h-full select-none flex-col gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:border-primary/40 " +
                  (editMode ? "animate-[wiggle_0.3s_ease-in-out_infinite]" : "")
                }
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

      <style>{`
        @keyframes wiggle {
          0% { transform: rotate(-0.6deg); }
          50% { transform: rotate(0.6deg); }
          100% { transform: rotate(-0.6deg); }
        }
      `}</style>
    </>
  );
}
