import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateQuestions, generateAppSpec } from "@/lib/claude";
import { nextFireAt, activeWeekdays } from "@/lib/schedule";
import type { DayKey } from "@/lib/appSpec";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const runtime = "nodejs";
// Large multi-week plans can take longer than a minute to generate; give the
// function headroom so it finishes instead of being killed mid-generation.
export const maxDuration = 300;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: {
    stage?: string;
    md?: string;
    answers?: Record<string, string>;
    alertTime?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const md = (body.md || "").trim();
  if (!md) return NextResponse.json({ error: "Missing 'md'" }, { status: 400 });

  try {
    // Stage 1: clarifying questions
    if (body.stage === "questions") {
      const out = await generateQuestions(md);
      return NextResponse.json(out);
    }

    // Stage 2: build + persist
    const today = new Date().toISOString().slice(0, 10);
    const spec = await generateAppSpec(md, body.answers || {}, today);

    // Reminders are synthesized deterministically: one alert covering every day
    // that has activity, at the user-chosen time. Drop any model-emitted reminders
    // and inject our single activity reminder.
    const alertTime = TIME_RE.test(body.alertTime ?? "") ? body.alertTime! : "08:00";
    spec.components = spec.components.filter((c) => c.type !== "reminder");
    // If the model grouped components into tabs, attach the injected reminder to
    // the last used tab so it doesn't spawn an orphan tab of its own.
    const lastTab = [...spec.components].reverse().find((c) => c.tab)?.tab;
    spec.components.push({
      type: "reminder",
      id: "activity-alert",
      tab: lastTab,
      title: spec.name,
      body: `You've got ${spec.name} today — open it and keep your streak.`,
      days: activeWeekdays(spec),
      time: alertTime,
    });

    const { data: app, error: insertErr } = await supabase
      .from("apps")
      .insert({
        user_id: user.id,
        name: spec.name,
        icon: spec.icon,
        app_spec: spec,
        source_md: md,
      })
      .select("id")
      .single();

    if (insertErr || !app) {
      return NextResponse.json(
        { error: "Failed to save app: " + (insertErr?.message ?? "unknown") },
        { status: 500 }
      );
    }

    // Materialize reminder components into reminder rows.
    const reminders = spec.components.filter((c) => c.type === "reminder");
    if (reminders.length) {
      const rows = reminders.map((r) => {
        const rem = r as Extract<typeof r, { type: "reminder" }>;
        return {
          app_id: app.id,
          title: rem.title,
          body: rem.body,
          days: rem.days,
          time: rem.time,
          next_fire_at: nextFireAt(rem.days as DayKey[], rem.time)?.toISOString() ?? null,
        };
      });
      await supabase.from("reminders").insert(rows);
    }

    return NextResponse.json({ appId: app.id, spec });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
