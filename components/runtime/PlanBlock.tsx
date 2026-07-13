"use client";

import { useMemo, useState } from "react";
import { Card, CardTitle } from "./Card";
import { latestByKey, type LogRow } from "./useAppData";
import type { AppComponent } from "@/lib/appSpec";

type Props = Extract<AppComponent, { type: "plan" }> & {
  logs: LogRow[];
  addLog: (metricKey: string, value: Record<string, unknown>) => Promise<void>;
};

function itemKey(id: string, week: number, dayIndex: number, itemIndex: number): string {
  return `done:${id}:w${week}:${dayIndex}:${itemIndex}`;
}

function notesKey(id: string, week: number): string {
  return `notes:${id}:w${week}`;
}

export function PlanBlock({ id, title, weeks, logs, addLog }: Props) {
  // Weeks in ascending order so the selector reads 1 → N.
  const sortedWeeks = useMemo(
    () => [...weeks].sort((a, b) => a.number - b.number),
    [weeks]
  );

  const [activeWeek, setActiveWeek] = useState(sortedWeeks[0]?.number ?? 1);
  const week =
    sortedWeeks.find((w) => w.number === activeWeek) ?? sortedWeeks[0];

  // Per-week progress across every item in the active week.
  const { done, total } = useMemo(() => {
    let d = 0;
    let t = 0;
    week.days.forEach((day, di) => {
      day.items.forEach((_, ii) => {
        t++;
        const key = itemKey(id, week.number, di, ii);
        if (latestByKey(logs, key)?.value?.done) d++;
      });
    });
    return { done: d, total: t };
  }, [week, id, logs]);

  const pct = total ? Math.round((done / total) * 100) : 0;

  // Notes for the active week. Seeded from the latest saved row; saved on blur.
  const savedNotes = (latestByKey(logs, notesKey(id, week.number))?.value?.text as string) ?? "";
  const [notesDraft, setNotesDraft] = useState(savedNotes);
  const [notesWeek, setNotesWeek] = useState(week.number);
  // When the selected week changes, re-seed the textarea from that week's saved note.
  if (notesWeek !== week.number) {
    setNotesWeek(week.number);
    setNotesDraft(savedNotes);
  }

  const currentIdx = sortedWeeks.findIndex((w) => w.number === week.number);

  return (
    <Card>
      <CardTitle>{title}</CardTitle>

      {/* Week selector */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={week.number}
          onChange={(e) => setActiveWeek(Number(e.target.value))}
          className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          aria-label="Select week"
        >
          {sortedWeeks.map((w) => (
            <option key={w.number} value={w.number}>
              Week {w.number}
            </option>
          ))}
        </select>
        <button
          onClick={() => setActiveWeek(sortedWeeks[Math.max(0, currentIdx - 1)].number)}
          disabled={currentIdx <= 0}
          className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-muted transition enabled:hover:text-foreground disabled:opacity-40"
        >
          ‹ Prev
        </button>
        <button
          onClick={() =>
            setActiveWeek(sortedWeeks[Math.min(sortedWeeks.length - 1, currentIdx + 1)].number)
          }
          disabled={currentIdx >= sortedWeeks.length - 1}
          className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-muted transition enabled:hover:text-foreground disabled:opacity-40"
        >
          Next ›
        </button>
      </div>

      {/* Week heading + theme badge */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-foreground">Week {week.number}</h3>
        {week.theme ? (
          <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-medium text-foreground">
            {week.theme}
          </span>
        ) : null}
      </div>

      {/* Per-week progress bar */}
      <div className="mb-4">
        <div className="h-2.5 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted">
          {done} of {total} complete ({pct}%)
        </p>
      </div>

      {/* Days */}
      <div className="space-y-4">
        {week.days.map((day, di) => (
          <div key={di}>
            <h4 className="mb-1.5 text-sm font-semibold text-foreground">{day.day}</h4>
            <ol className="space-y-2">
              {day.items.map((item, ii) => {
                const key = itemKey(id, week.number, di, ii);
                const isDone = Boolean(latestByKey(logs, key)?.value?.done);
                return (
                  <li
                    key={ii}
                    className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3"
                  >
                    <button
                      onClick={() => addLog(key, { done: !isDone })}
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        isDone ? "border-success bg-success text-white" : "border-border"
                      }`}
                      aria-label={isDone ? "Mark not done" : "Mark done"}
                    >
                      {isDone ? "✓" : ""}
                    </button>
                    <span
                      className={`min-w-0 flex-1 text-sm ${
                        isDone ? "text-muted line-through" : "text-foreground"
                      }`}
                    >
                      {item}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>

      {/* Per-week notes */}
      <div className="mt-5">
        <label className="mb-1.5 block text-sm font-semibold text-foreground">Notes</label>
        <textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={() => {
            if (notesDraft !== savedNotes) addLog(notesKey(id, week.number), { text: notesDraft });
          }}
          placeholder="How you felt, HR, soreness, confidence…"
          className="min-h-[80px] w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground"
        />
      </div>
    </Card>
  );
}
