import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush, type PushSub } from "@/lib/push";
import { nextFireAt } from "@/lib/schedule";
import type { DayKey } from "@/lib/appSpec";

export const runtime = "nodejs";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  const url = new URL(req.url);
  return auth === `Bearer ${secret}` || url.searchParams.get("secret") === secret;
}

async function run(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const base = process.env.NEXT_PUBLIC_APP_URL || "";

  const { data: due } = await supabase
    .from("reminders")
    .select("id, app_id, title, body, days, time")
    .eq("enabled", true)
    .lte("next_fire_at", now.toISOString());

  let sent = 0;
  for (const rem of due ?? []) {
    const { data: app } = await supabase
      .from("apps")
      .select("user_id")
      .eq("id", rem.app_id)
      .single();
    if (!app) continue;

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, keys")
      .eq("user_id", app.user_id);

    for (const s of subs ?? []) {
      const result = await sendPush(s as PushSub, {
        title: rem.title,
        body: rem.body,
        url: `${base}/a/${rem.app_id}`,
        icon: `${base}/api/icon/${rem.app_id}?size=192`,
      });
      if (result.ok) sent++;
      if (result.gone) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", (s as PushSub).endpoint);
      }
    }

    // Reschedule for the next occurrence.
    const next = nextFireAt(rem.days as DayKey[], rem.time, now);
    await supabase
      .from("reminders")
      .update({ next_fire_at: next?.toISOString() ?? null })
      .eq("id", rem.id);
  }

  return NextResponse.json({ processed: due?.length ?? 0, sent });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
