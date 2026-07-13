import { createClient } from "@/lib/supabase/server";
import { isHtmlApp } from "@/lib/htmlApp";

export const runtime = "nodejs";

// Serves an imported HTML app's document into the sandboxed iframe on the app
// page. Owner-gated: the server client applies the `apps owner` RLS policy, so
// only the app's owner can fetch its HTML.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ appId: string }> }
) {
  const { appId } = await params;
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("apps")
    .select("app_spec")
    .eq("id", appId)
    .single();

  if (!app || !isHtmlApp(app.app_spec)) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(app.app_spec.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
