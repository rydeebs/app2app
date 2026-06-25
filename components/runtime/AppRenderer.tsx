"use client";

import { useAppData } from "./useAppData";
import { MarkdownBlock } from "./MarkdownBlock";
import { ScheduleBlock } from "./ScheduleBlock";
import { ChecklistBlock } from "./ChecklistBlock";
import { MetricBlock } from "./MetricBlock";
import { LogEntryBlock } from "./LogEntryBlock";
import { ReminderBlock } from "./ReminderBlock";
import type { AppSpec } from "@/lib/appSpec";

export function AppRenderer({ appId, spec }: { appId: string; spec: AppSpec }) {
  const { logs, loading, addLog } = useAppData(appId);

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 pb-24 pt-6">
      <header className="mb-2 flex items-center gap-3 px-1">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
          style={{ background: spec.icon.color + "22" }}
        >
          {spec.icon.emoji}
        </span>
        <div>
          <h1 className="font-serif-italic text-2xl text-foreground">{spec.name}</h1>
          {spec.tagline ? <p className="text-sm text-muted">{spec.tagline}</p> : null}
        </div>
      </header>

      {loading ? (
        <p className="px-1 text-sm text-muted">Loading your progress…</p>
      ) : (
        spec.components.map((c) => {
          switch (c.type) {
            case "markdown":
              return <MarkdownBlock key={c.id} {...c} />;
            case "schedule":
              return <ScheduleBlock key={c.id} {...c} logs={logs} addLog={addLog} />;
            case "checklist":
              return <ChecklistBlock key={c.id} {...c} logs={logs} addLog={addLog} />;
            case "metric":
              return <MetricBlock key={c.id} {...c} logs={logs} />;
            case "logEntry": {
              const metric = spec.components.find(
                (m) => m.type === "metric" && m.metricKey === c.metricKey
              );
              const metricUnit = metric && metric.type === "metric" ? metric.unit : undefined;
              return (
                <LogEntryBlock
                  key={c.id}
                  {...c}
                  logs={logs}
                  addLog={addLog}
                  metricUnit={metricUnit}
                />
              );
            }
            case "reminder":
              return <ReminderBlock key={c.id} {...c} />;
            default:
              return null;
          }
        })
      )}
    </div>
  );
}
