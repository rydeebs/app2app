"use client";

import { Card, CardTitle } from "./Card";
import { seriesForKey, type LogRow } from "./useAppData";
import { formatDuration, formatNumber } from "./format";
import type { AppComponent } from "@/lib/appSpec";

type Props = Extract<AppComponent, { type: "metric" }> & { logs: LogRow[] };

function num(v: unknown): number | null {
  return typeof v === "number" && !isNaN(v) ? v : null;
}

export function MetricBlock(props: Props) {
  const { metricKey, title, unit, start, goal, direction, logs } = props;
  const series = seriesForKey(logs, metricKey)
    .map((l) => num(l.value?.value))
    .filter((n): n is number => n !== null);

  const latest = series.length ? series[series.length - 1] : start ?? null;
  const isDuration = unit === "duration" || unit === "pace";

  const fmt = (n: number) => (isDuration ? formatDuration(n) : formatNumber(n) + (unit ? ` ${unit}` : ""));

  let progress: number | null = null;
  if (latest !== null && start !== undefined && goal !== undefined && start !== goal) {
    progress =
      direction === "decrease"
        ? (start - latest) / (start - goal)
        : (latest - start) / (goal - start);
    progress = Math.max(0, Math.min(1, progress));
  }

  const reached =
    latest !== null && goal !== undefined
      ? direction === "decrease"
        ? latest <= goal
        : latest >= goal
      : false;

  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <div className="flex items-end justify-between">
        <div>
          <p className="font-serif-italic text-4xl text-foreground">
            {latest !== null ? fmt(latest) : "—"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {goal !== undefined ? `Goal: ${fmt(goal)}` : "current"}
            {series.length ? ` · ${series.length} entr${series.length === 1 ? "y" : "ies"}` : ""}
          </p>
        </div>
        {reached ? (
          <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">
            Goal reached 🎉
          </span>
        ) : null}
      </div>
      {progress !== null ? (
        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      ) : null}
    </Card>
  );
}
