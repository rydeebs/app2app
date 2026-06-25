"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteAccountButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function remove() {
    setBusy(true);
    setErr("");
    const res = await fetch("/api/account/delete", { method: "POST" });
    if (res.ok) {
      router.push("/login");
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => ({}));
    setErr(data.error ?? "Could not delete account");
    setBusy(false);
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-xs text-muted transition hover:text-danger"
      >
        Delete account
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">Delete permanently?</span>
        <button
          onClick={remove}
          disabled={busy}
          className="rounded-lg border border-danger px-2 py-1 text-xs font-medium text-danger disabled:opacity-50"
        >
          {busy ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="rounded-lg border border-border px-2 py-1 text-xs text-muted"
        >
          Cancel
        </button>
      </div>
      {err ? <p className="text-xs text-danger">{err}</p> : null}
    </div>
  );
}
