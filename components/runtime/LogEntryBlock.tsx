"use client";

import { useRef, useState } from "react";
import { Card, CardTitle } from "./Card";
import { parseDuration } from "./format";
import { fileToInlineImage } from "./imageImport";
import type { LogRow } from "./useAppData";
import type { AppComponent } from "@/lib/appSpec";

type Props = Extract<AppComponent, { type: "logEntry" }> & {
  logs: LogRow[];
  addLog: (metricKey: string, value: Record<string, unknown>) => Promise<void>;
  metricUnit?: string;
};

export function LogEntryBlock({ title, metricKey, fields, photoImport, metricUnit, addLog }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setImportError("");
    setImporting(true);
    try {
      const { base64, mediaType } = await fileToInlineImage(file);
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields, image: base64, mediaType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not read photo");
      const extracted = (data.values ?? {}) as Record<string, string>;
      if (Object.keys(extracted).length === 0) {
        setImportError("Couldn't read any stats from that photo — enter them manually.");
      } else {
        setValues((p) => ({ ...p, ...extracted }));
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Could not read photo");
    } finally {
      setImporting(false);
    }
  }

  async function submit() {
    setSaving(true);
    const raw: Record<string, string> = {};
    for (const f of fields) raw[f.key] = values[f.key] ?? "";

    // The metric value comes from the field whose key matches metricKey. If the
    // generated keys don't line up, fall back to a field whose kind matches the
    // metric (duration vs number) before any numeric field, so we never record
    // the wrong stat (e.g. distance) against a pace/time metric.
    const wantsDuration = metricUnit === "duration" || metricUnit === "pace";
    const metricField =
      fields.find(
        (f) => f.key === metricKey && (f.kind === "number" || f.kind === "duration")
      ) ??
      fields.find((f) => f.kind === (wantsDuration ? "duration" : "number")) ??
      fields.find((f) => f.kind === "number" || f.kind === "duration");

    let numericValue: number | null = null;
    if (metricField) {
      const v = values[metricField.key] ?? "";
      numericValue = metricField.kind === "duration" ? parseDuration(v) : Number(v);
      if (numericValue !== null && isNaN(numericValue)) numericValue = null;
    }

    await addLog(metricKey, { value: numericValue, raw });
    setSaving(false);
    setSaved(true);
    setValues({});
    setTimeout(() => setSaved(false), 1800);
  }

  const canSubmit = fields.some((f) => (values[f.key] ?? "").trim() !== "");

  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <div className="space-y-3">
        {photoImport ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onPhoto}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background px-4 py-2.5 text-sm text-muted transition hover:border-primary hover:text-foreground disabled:opacity-50"
            >
              {importing ? "Reading photo…" : "📷 Import from photo"}
            </button>
            {importError ? <p className="text-xs text-danger">{importError}</p> : null}
          </>
        ) : null}
        {fields.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-sm text-muted">
              {f.label}
              {f.unit ? ` (${f.unit})` : f.kind === "duration" ? " (mm:ss)" : ""}
            </span>
            <input
              type={f.kind === "number" ? "number" : "text"}
              inputMode={f.kind === "number" ? "decimal" : undefined}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-primary"
              placeholder={f.kind === "duration" ? "7:30" : ""}
            />
          </label>
        ))}
        <button
          onClick={submit}
          disabled={!canSubmit || saving}
          className="w-full rounded-xl bg-primary px-4 py-2.5 font-medium text-primary-ink transition disabled:opacity-40"
        >
          {saving ? "Saving…" : saved ? "Logged ✓" : "Log it"}
        </button>
      </div>
    </Card>
  );
}
