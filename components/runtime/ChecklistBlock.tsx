"use client";

import { Card, CardTitle } from "./Card";
import { latestByKey, type LogRow } from "./useAppData";
import type { AppComponent } from "@/lib/appSpec";

type Props = Extract<AppComponent, { type: "checklist" }> & {
  logs: LogRow[];
  addLog: (metricKey: string, value: Record<string, unknown>) => Promise<void>;
};

export function ChecklistBlock({ id, title, items, repeat, logs, addLog }: Props) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {repeat !== "none" ? (
        <p className="-mt-2 mb-3 text-xs uppercase tracking-wide text-accent">{repeat}</p>
      ) : null}
      <ul className="space-y-2">
        {items.map((item) => {
          const key = `done:${id}:${item.id}`;
          const done = Boolean(latestByKey(logs, key)?.value?.done);
          return (
            <li key={item.id}>
              <button
                onClick={() => addLog(key, { done: !done })}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-background"
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    done ? "border-primary bg-primary text-primary-ink" : "border-border bg-surface"
                  }`}
                >
                  {done ? "✓" : ""}
                </span>
                <span className={done ? "text-muted line-through" : "text-foreground"}>
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
