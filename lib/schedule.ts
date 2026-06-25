import { DAY_KEYS, type DayKey, type AppSpec } from "@/lib/appSpec";

/**
 * Compute the next UTC timestamp at which a reminder should fire, given the
 * days-of-week + HH:MM (interpreted in the provided IANA timezone offset-free
 * for MVP: we treat time as the server's local wall clock).
 *
 * For MVP simplicity we compute against UTC. A production version would store
 * the user's timezone and convert.
 */
export function nextFireAt(
  days: DayKey[],
  time: string,
  from: Date = new Date()
): Date | null {
  if (!days.length) return null;
  const [h, m] = time.split(":").map(Number);
  const dayIdxSet = new Set(days.map((d) => DAY_KEYS.indexOf(d))); // 0=mon..6=sun

  for (let i = 0; i < 14; i++) {
    const cand = new Date(from);
    cand.setUTCDate(from.getUTCDate() + i);
    cand.setUTCHours(h, m, 0, 0);
    // JS getUTCDay: 0=Sun..6=Sat -> convert to 0=Mon..6=Sun
    const jsDay = cand.getUTCDay();
    const monIdx = (jsDay + 6) % 7;
    if (dayIdxSet.has(monIdx) && cand.getTime() > from.getTime()) {
      return cand;
    }
  }
  return null;
}

/**
 * Derive the set of weekdays that have any activity in a spec, used to schedule
 * a single "you have activity today" reminder. Sources:
 *  - schedule items: each YYYY-MM-DD date → its weekday
 *  - checklist with repeat "daily" → all 7 days
 * Falls back to all 7 days when nothing yields a day signal.
 */
export function activeWeekdays(spec: AppSpec): DayKey[] {
  const set = new Set<DayKey>();
  for (const c of spec.components) {
    if (c.type === "schedule") {
      for (const item of c.items) {
        const d = new Date(item.date + "T00:00:00Z");
        if (isNaN(d.getTime())) continue;
        set.add(DAY_KEYS[(d.getUTCDay() + 6) % 7]); // JS Sun=0 → Mon=0..Sun=6
      }
    } else if (c.type === "checklist" && c.repeat === "daily") {
      for (const d of DAY_KEYS) set.add(d);
    }
  }
  if (set.size === 0) return [...DAY_KEYS];
  return DAY_KEYS.filter((d) => set.has(d)); // keep Mon..Sun order
}
