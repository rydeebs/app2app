import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_HTML_BYTES,
  looksLikeHtml,
  extractTitle,
  extractThemeColor,
} from "@/lib/htmlApp";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { html?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const html = (body.html || "").trim();
  if (!html) {
    return NextResponse.json({ error: "Missing 'html'" }, { status: 400 });
  }
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
    return NextResponse.json(
      { error: "That HTML file is too large (max 2 MB)." },
      { status: 413 }
    );
  }
  if (!looksLikeHtml(html)) {
    return NextResponse.json(
      { error: "That doesn't look like an HTML file." },
      { status: 400 }
    );
  }

  const name = (body.name || extractTitle(html)).slice(0, 40);
  const icon = { emoji: "📄", color: extractThemeColor(html) || "#9b86d4" };

  const { data: app, error: insertErr } = await supabase
    .from("apps")
    .insert({
      user_id: user.id,
      name,
      icon,
      app_spec: { kind: "html", html },
      source_md: null,
    })
    .select("id")
    .single();

  if (insertErr || !app) {
    return NextResponse.json(
      { error: "Failed to save app: " + (insertErr?.message ?? "unknown") },
      { status: 500 }
    );
  }

  return NextResponse.json({ appId: app.id });
}
