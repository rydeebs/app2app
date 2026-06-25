"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Question = { key: string; question: string };

export default function CreatePage() {
  const router = useRouter();
  const [step, setStep] = useState<"paste" | "questions" | "building">("paste");
  const [md, setMd] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [alertTime, setAlertTime] = useState("08:00");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setError("");
    const text = await file.text();
    setMd(text);
    setFileName(file.name);
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
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ md, answers, alertTime }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Generation failed");
      setStep("questions");
      return;
    }
    router.push(`/a/${data.appId}`);
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
            Upload a <code className="font-mono text-foreground">.md</code> file or paste a plan
            from ChatGPT, Claude, or anywhere — a running schedule, study plan, habit system.
            We&apos;ll turn it into a trackable app on your home screen.
          </p>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface px-4 py-5 text-sm text-muted transition hover:border-primary hover:text-foreground">
            <input
              type="file"
              accept=".md,.markdown,text/markdown,text/plain"
              onChange={onFile}
              className="hidden"
            />
            {fileName ? (
              <span className="text-foreground">
                Loaded <span className="font-medium">{fileName}</span> — review below or choose
                another
              </span>
            ) : (
              <span>Upload a .md file</span>
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
              <input
                value={answers[q.key] ?? ""}
                onChange={(e) => setAnswers((p) => ({ ...p, [q.key]: e.target.value }))}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 outline-none focus:border-primary"
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

      {step === "building" && (
        <div className="py-20 text-center">
          <p className="font-serif-italic text-xl text-foreground">Building your app…</p>
          <p className="mt-2 text-sm text-muted">Shaping your plan into something you can tap.</p>
        </div>
      )}
    </main>
  );
}
