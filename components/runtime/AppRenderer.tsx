"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAppData } from "./useAppData";
import { MarkdownBlock } from "./MarkdownBlock";
import { ScheduleBlock } from "./ScheduleBlock";
import { ChecklistBlock } from "./ChecklistBlock";
import { MetricBlock } from "./MetricBlock";
import { LogEntryBlock } from "./LogEntryBlock";
import { PlanBlock } from "./PlanBlock";
import { ReminderBlock } from "./ReminderBlock";
import type { AppSpec, AppComponent } from "@/lib/appSpec";
import type { LogRow } from "./useAppData";

export function AppRenderer({ appId, spec }: { appId: string; spec: AppSpec }) {
  const { logs, loading, addLog } = useAppData(appId);

  // Ordered, distinct tab labels. Components without a `tab` fall under "Home".
  // If only one tab results, render a plain feed (no tab bar) — keeping tab-less
  // apps (and all existing data) rendering exactly as before.
  const tabs = useMemo(() => {
    const seen: string[] = [];
    for (const c of spec.components) {
      const t = c.tab ?? "Home";
      if (!seen.includes(t)) seen.push(t);
    }
    return seen;
  }, [spec.components]);

  const [active, setActive] = useState(tabs[0]);
  const activeTab = tabs.includes(active) ? active : tabs[0];
  const hasTabs = tabs.length > 1;

  const visible = hasTabs
    ? spec.components.filter((c) => (c.tab ?? "Home") === activeTab)
    : spec.components;

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 pb-24 pt-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 px-1 text-sm text-muted transition hover:text-foreground"
      >
        ‹ Your apps
      </Link>

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

      {hasTabs ? (
        <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActive(t)}
              className={
                "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition " +
                (t === activeTab
                  ? "bg-primary text-primary-ink"
                  : "border border-border bg-background text-muted hover:text-foreground")
              }
            >
              {t}
            </button>
          ))}
        </nav>
      ) : null}

      {loading ? (
        <p className="px-1 text-sm text-muted">Loading your progress…</p>
      ) : (
        visible.map((c) => renderBlock(c, spec, logs, addLog))
      )}
    </div>
  );
}

function renderBlock(
  c: AppComponent,
  spec: AppSpec,
  logs: LogRow[],
  addLog: (metricKey: string, value: Record<string, unknown>) => Promise<void>
) {
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
        <LogEntryBlock key={c.id} {...c} logs={logs} addLog={addLog} metricUnit={metricUnit} />
      );
    }
    case "plan":
      return <PlanBlock key={c.id} {...c} logs={logs} addLog={addLog} />;
    case "reminder":
      return <ReminderBlock key={c.id} {...c} />;
    default:
      return null;
  }
}
