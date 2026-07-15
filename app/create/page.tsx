"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { extractTitle, looksLikeHtml } from "@/lib/htmlApp";

type QuestionType = "select" | "multiselect" | "date" | "daterange" | "number" | "text";
type Question = {
  key: string;
  question: string;
  type?: QuestionType;
  options?: string[];
  unit?: string;
};

const OTHER = "__other__";

// Renders the right control for a question's type and emits a serialized string
// answer (dates as YYYY-MM-DD, ranges as "start to end", multi-select comma-joined)
// so the backend keeps receiving a plain Record<string,string>.
function QuestionField({
  q,
  value,
  onChange,
}: {
  q: Question;
  value: string;
  onChange: (serialized: string) => void;
}) {
  const inputClass =
    "w-full rounded-xl border border-border bg-surface px-3 py-2.5 outline-none focus:border-primary";

  // Local UI state for multi-part controls.
  const [selectChoice, setSelectChoice] = useState("");
  const [otherText, setOtherText] = useState("");
  const [multi, setMulti] = useState<string[]>([]);
  const multiRef = useRef<string[]>([]); // always-current selection, avoids stale closures
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [num, setNum] = useState("");

  switch (q.type) {
    case "select":
      return (
        <div className="space-y-2">
          <select
            value={selectChoice}
            onChange={(e) => {
              const v = e.target.value;
              setSelectChoice(v);
              onChange(v === OTHER ? otherText : v === "" ? "" : v);
            }}
            className={inputClass}
          >
            <option value="">Select…</option>
            {(q.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
            <option value={OTHER}>Other…</option>
          </select>
          {selectChoice === OTHER ? (
            <input
              value={otherText}
              onChange={(e) => {
                setOtherText(e.target.value);
                onChange(e.target.value);
              }}
              placeholder="Type your answer"
              className={inputClass}
            />
          ) : null}
        </div>
      );

    case "multiselect": {
      const emit = (list: string[], other: string) => {
        const withOther = other.trim() ? [...list, other.trim()] : list;
        onChange(withOther.join(", "));
      };
      // Read/write the live selection through a ref so successive toggles never
      // see a stale value, and onChange is called outside any render/updater.
      const toggle = (o: string) => {
        const prev = multiRef.current;
        const next = prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o];
        multiRef.current = next;
        setMulti(next);
        emit(next, otherText);
      };
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {(q.options ?? []).map((o) => {
              const on = multi.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => toggle(o)}
                  className={
                    "rounded-full px-3 py-1.5 text-sm font-medium transition " +
                    (on
                      ? "bg-primary text-primary-ink"
                      : "border border-border bg-background text-muted hover:text-foreground")
                  }
                >
                  {o}
                </button>
              );
            })}
          </div>
          <input
            value={otherText}
            onChange={(e) => {
              setOtherText(e.target.value);
              emit(multiRef.current, e.target.value);
            }}
            placeholder="Other (optional)"
            className={inputClass}
          />
        </div>
      );
    }

    case "date":
      return (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );

    case "daterange":
      return (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={rangeStart}
            onChange={(e) => {
              setRangeStart(e.target.value);
              onChange(e.target.value && rangeEnd ? `${e.target.value} to ${rangeEnd}` : e.target.value);
            }}
            className={inputClass}
            aria-label="Start date"
          />
          <span className="text-sm text-muted">to</span>
          <input
            type="date"
            value={rangeEnd}
            onChange={(e) => {
              setRangeEnd(e.target.value);
              onChange(rangeStart && e.target.value ? `${rangeStart} to ${e.target.value}` : e.target.value);
            }}
            className={inputClass}
            aria-label="End date"
          />
        </div>
      );

    case "number":
      return (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={num}
            onChange={(e) => {
              setNum(e.target.value);
              onChange(e.target.value ? `${e.target.value}${q.unit ? ` ${q.unit}` : ""}` : "");
            }}
            className={inputClass}
          />
          {q.unit ? <span className="shrink-0 text-sm text-muted">{q.unit}</span> : null}
        </div>
      );

    default:
      return (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
  }
}

export default function CreatePage() {
  const router = useRouter();
  const [step, setStep] = useState<"paste" | "questions" | "htmlImport" | "building">("paste");
  const [md, setMd] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [alertTime, setAlertTime] = useState("08:00");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [html, setHtml] = useState("");
  const [htmlTitle, setHtmlTitle] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setError("");
    const text = await file.text();
    const isHtml = /\.html?$/i.test(file.name) || file.type === "text/html" || looksLikeHtml(text);
    if (isHtml) {
      // Fully-designed HTML files are imported verbatim, skipping the LLM path.
      setHtml(text);
      setHtmlTitle(extractTitle(text));
      setFileName(file.name);
      setStep("htmlImport");
      return;
    }
    setMd(text);
    setFileName(file.name);
  }

  async function importHtml() {
    setError("");
    setStep("building");
    const res = await fetch("/api/import-html", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html, name: htmlTitle }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Import failed");
      setStep("htmlImport");
      return;
    }
    router.push(`/a/${data.appId}`);
  }

  async function getQuestions() {
    setError("");
    if (md.trim().length < 20) {
      setError("Paste a bit more of your plan first.");
      return;
    }
    setStep("building");
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: "questions", md }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Something went wrong");
      setStep("paste");
      return;
    }
    setQuestions(data.questions || []);
    setStep("questions");
  }

  async function build() {
    setError("");
    setStep("building");
    // Guard against a hung request so the user never sees an infinite spinner.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ md, answers, alertTime }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Generation failed");
        setStep("questions");
        return;
      }
      router.push(`/a/${data.appId}`);
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === "AbortError"
          ? "That took too long. Try again, or trim the plan a little."
          : "Network error — please try again."
      );
      setStep("questions");
    } finally {
      clearTimeout(timeout);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <Link href="/" className="text-sm text-muted">
        ← Your apps
      </Link>
      <h1 className="mb-6 mt-2 font-serif-italic text-3xl text-foreground">Build an app</h1>

      {step === "paste" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Upload a <code className="font-mono text-foreground">.md</code> or{" "}
            <code className="font-mono text-foreground">.html</code> file, or paste a plan from
            ChatGPT, Claude, or anywhere — a running schedule, study plan, habit system. We&apos;ll
            turn it into an app on your home screen. An HTML file becomes a standalone app that looks
            exactly like the file.
          </p>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface px-4 py-5 text-sm text-muted transition hover:border-primary hover:text-foreground">
            <input
              type="file"
              accept=".md,.markdown,.html,.htm,text/markdown,text/plain,text/html"
              onChange={onFile}
              className="hidden"
            />
            {fileName ? (
              <span className="text-foreground">
                Loaded <span className="font-medium">{fileName}</span> — review below or choose
                another
              </span>
            ) : (
              <span>Upload a .md or .html file</span>
            )}
          </label>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" />
            or paste it
            <span className="h-px flex-1 bg-border" />
          </div>
          <textarea
            value={md}
            onChange={(e) => {
              setMd(e.target.value);
              if (fileName) setFileName("");
            }}
            rows={12}
            placeholder="# My 5K Plan&#10;Goal: sub-7:30 pace..."
            className="w-full rounded-2xl border border-border bg-surface p-4 font-mono text-sm outline-none focus:border-primary"
          />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button
            onClick={getQuestions}
            className="w-full rounded-xl bg-primary px-4 py-3 font-medium text-primary-ink"
          >
            Continue
          </button>
        </div>
      )}

      {step === "questions" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">A few quick questions to tailor your app:</p>
          {questions.map((q) => (
            <label key={q.key} className="block">
              <span className="mb-1 block text-sm text-foreground">{q.question}</span>
              <QuestionField
                q={q}
                value={answers[q.key] ?? ""}
                onChange={(v) => setAnswers((p) => ({ ...p, [q.key]: v }))}
              />
            </label>
          ))}
          <label className="block">
            <span className="mb-1 block text-sm text-foreground">
              When should daily alerts fire on days you have activity?
            </span>
            <input
              type="time"
              value={alertTime}
              onChange={(e) => setAlertTime(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 outline-none focus:border-primary"
            />
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button
            onClick={build}
            className="w-full rounded-xl bg-primary px-4 py-3 font-medium text-primary-ink"
          >
            Build my app
          </button>
        </div>
      )}

      {step === "htmlImport" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            This is a ready-made HTML file. We&apos;ll import it as a standalone app that looks and
            works exactly like the file — no AI conversion.
          </p>
          <label className="block">
            <span className="mb-1 block text-sm text-foreground">App name</span>
            <input
              value={htmlTitle}
              onChange={(e) => setHtmlTitle(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 outline-none focus:border-primary"
            />
          </label>
          <p className="text-xs text-muted">
            From <span className="font-medium text-foreground">{fileName}</span>. Only import HTML
            files you trust — the app runs the file&apos;s own code.
          </p>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setStep("paste");
                setHtml("");
                setFileName("");
                setError("");
              }}
              className="rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted transition hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={importHtml}
              className="flex-1 rounded-xl bg-primary px-4 py-3 font-medium text-primary-ink"
            >
              Import as app
            </button>
          </div>
        </div>
      )}

      {step === "building" && (
        <div className="py-20 text-center">
          <p className="font-serif-italic text-xl text-foreground">Building your app…</p>
          <p className="mt-2 text-sm text-muted">
            Shaping your plan into something you can tap. Bigger, multi-week plans can take up to a
            minute.
          </p>
        </div>
      )}
    </main>
  );
}
