import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractFieldsFromImage, type ExtractField } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/webp"] as const;
type Media = (typeof ALLOWED_MEDIA)[number];

// ~8MB of base64 ≈ 6MB image; the client downscales well below this.
const MAX_BASE64 = 8_000_000;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { fields?: ExtractField[]; image?: string; mediaType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fields = Array.isArray(body.fields) ? body.fields : [];
  const image = typeof body.image === "string" ? body.image : "";
  const mediaType = (body.mediaType ?? "image/jpeg") as string;

  if (!fields.length) return NextResponse.json({ error: "No fields" }, { status: 400 });
  if (!image) return NextResponse.json({ error: "No image" }, { status: 400 });
  if (image.length > MAX_BASE64) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }
  if (!ALLOWED_MEDIA.includes(mediaType as Media)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 415 });
  }

  try {
    const values = await extractFieldsFromImage(fields, image, mediaType as Media);
    return NextResponse.json({ values });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
