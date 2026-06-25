"use client";

import { Capacitor } from "@capacitor/core";

/**
 * Native (iOS) reminders via on-device local notifications. On the web this is a
 * no-op — the browser PWA keeps using Web Push (components/push/pushClient.ts).
 * A reminder is "fire at HH:MM on these weekdays", which maps 1:1 to an iOS
 * repeating calendar trigger, so no server / APNs / device token is needed.
 */

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export type NativeReminder = {
  id: string;
  title: string;
  body: string;
  days: string[]; // DAY_KEYS: mon..sun
  time: string; // HH:MM 24h
};

// iOS Calendar weekday component: 1 = Sunday … 7 = Saturday.
const IOS_WEEKDAY: Record<string, number> = {
  sun: 1,
  mon: 2,
  tue: 3,
  wed: 4,
  thu: 5,
  fri: 6,
  sat: 7,
};

// Stable, positive 32-bit id per (reminder, weekday) so re-enabling replaces
// the existing schedule instead of stacking duplicates.
function notifId(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return (Math.abs(h) % 2_000_000_000) + 1;
}

export async function scheduleAppReminders(
  reminders: NativeReminder[]
): Promise<{ ok: boolean; reason?: string }> {
  if (!isNative()) return { ok: false, reason: "not-native" };

  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== "granted") return { ok: false, reason: "permission-denied" };

  const notifications = [];
  for (const r of reminders) {
    const [hour, minute] = r.time.split(":").map((n) => Number(n));
    if (Number.isNaN(hour) || Number.isNaN(minute)) continue;
    for (const day of r.days) {
      const weekday = IOS_WEEKDAY[day];
      if (!weekday) continue;
      notifications.push({
        id: notifId(`${r.id}:${day}`),
        title: r.title,
        body: r.body,
        schedule: { on: { weekday, hour, minute }, allowWhileIdle: true, repeats: true },
      });
    }
  }

  if (!notifications.length) return { ok: false, reason: "no-days" };

  // Replace any prior schedule for these ids, then (re)schedule.
  await LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
  await LocalNotifications.schedule({ notifications });
  return { ok: true };
}
