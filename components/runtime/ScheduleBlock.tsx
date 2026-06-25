"use client";

import { Card, CardTitle } from "./Card";
import { latestByKey, type LogRow } from "./useAppData";
import type { AppComponent } from "@/lib/appSpec";

type Props = Extract<AppComponent, { type: "schedule" }> & {
  logs: LogRow[];
  addLog: (metricKey: string, value: Record<string, unknown>) => Promise<void>;
};

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function ScheduleBlock({ id, title, items, logs, addLog }: Props) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <ol className="space-y-2">
        {sorted.map((item) => {
          const key = `done:${id}:${item.id}`;
          const done = Boolean(latestByKey(logs, key)?.value?.done);
          const isToday = item.date === todayIso;
          return (
            <li
              key={item.id}
              className={`flex items-start gap-3 rounded-xl border p-3 ${
                isToday ? "border-primary bg-primary/5" : "border-border bg-surface"
              }`}
            >
              <button
                onClick={() => addLog(key, { done: !done })}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                  done ? "border-success bg-success text-white" : "border-border"
                }`}
                aria-label={done ? "Mark not done" : "Mark done"}
              >
                {done ? "✓" : ""}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`font-medium ${done ? "text-muted line-through" : "text-foreground"}`}>
                    {item.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{formatDate(item.date)}</span>
                </div>
                {item.detail ? <p className="mt-0.5 text-sm text-muted">{item.detail}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
