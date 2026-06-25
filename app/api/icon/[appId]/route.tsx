import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Public metadata only (emoji + color) — used for installable app icons.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ appId: string }> }
) {
  const { appId } = await params;
  const { searchParams } = new URL(req.url);
  const size = Math.min(Number(searchParams.get("size") || 512), 1024);

  const supabase = createAdminClient();
  const { data } = await supabase.from("apps").select("icon").eq("id", appId).single();
  const icon = (data?.icon as { emoji?: string; color?: string }) || {};
  const emoji = icon.emoji || "📦";
  const color = icon.color || "#9b86d4";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: color,
          fontSize: size * 0.6,
        }}
      >
        {emoji}
      </div>
    ),
    { width: size, height: size }
  );
}
