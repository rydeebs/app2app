import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Per-app web manifest so each generated app installs with its own name + icon.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ appId: string }> }
) {
  const { appId } = await params;
  const supabase = createAdminClient();
  const { data } = await supabase.from("apps").select("name, icon").eq("id", appId).single();

  const name = data?.name || "Tracker";
  const color = (data?.icon as { color?: string })?.color || "#9b86d4";

  const manifest = {
    name,
    short_name: name.slice(0, 12),
    start_url: `/a/${appId}`,
    scope: `/a/${appId}`,
    display: "standalone",
    background_color: "#faf7f0",
    theme_color: color,
    icons: [
      { src: `/api/icon/${appId}?size=192`, sizes: "192x192", type: "image/png" },
      { src: `/api/icon/${appId}?size=512`, sizes: "512x512", type: "image/png" },
      {
        src: `/api/icon/${appId}?size=512`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
