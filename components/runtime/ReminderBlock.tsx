"use client";

import { useState } from "react";
import { Card, CardTitle } from "./Card";
import { subscribeToPush, isStandalone } from "@/components/push/pushClient";
import { isNative, scheduleAppReminders } from "@/components/native/notify";
import type { AppComponent } from "@/lib/appSpec";

type Props = Extract<AppComponent, { type: "reminder" }>;

const DAY_LABEL: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

export function ReminderBlock({ id, title, body, days, time }: Props) {
  const [status, setStatus] = useState<"idle" | "working" | "on" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function enable() {
    setStatus("working");

    // Native iOS app: schedule on-device local notifications (no server / Web Push).
    if (isNative()) {
      const res = await scheduleAppReminders([{ id, title, body, days, time }]);
      if (res.ok) {
        setStatus("on");
      } else {
        setStatus("error");
        setMsg(
          res.reason === "permission-denied"
            ? "Enable notifications for Shelf in Settings to get alerts."
            : "Could not schedule alerts."
        );
      }
      return;
    }

    // Browser PWA: Web Push (requires the app added to the Home Screen on iOS Safari).
    if (!isStandalone()) {
      setStatus("error");
      setMsg("On iPhone, first add this app to your Home Screen, then enable from there.");
      return;
    }
    const res = await subscribeToPush();
    if (res.ok) {
      setStatus("on");
    } else {
      setStatus("error");
      setMsg(res.reason ?? "Could not enable notifications");
    }
  }

  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-foreground">{body}</p>
          <p className="mt-1 text-xs text-muted">
            {days.map((d) => DAY_LABEL[d]).join(", ")} · {time}
          </p>
        </div>
        <button
          onClick={enable}
          disabled={status === "working" || status === "on"}
          className="shrink-0 rounded-xl border border-primary px-3 py-2 text-sm font-medium text-primary transition disabled:opacity-50"
        >
          {status === "on" ? "Notifications on ✓" : status === "working" ? "…" : "Enable alerts"}
        </button>
      </div>
      {status === "error" ? <p className="mt-2 text-xs text-danger">{msg}</p> : null}
    </Card>
  );
}
