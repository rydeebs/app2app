import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractFieldsFromImage, type ExtractField } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/webp"] as const;
type Media = (typeof ALLOWED_MEDIA)[number];

// ~8MB of base64 ≈ 6MB image; the client downscales well below this.
const MAX_BASE64 = 8_000_000;
// Combined into a single Claude call, so cap the count to stay within budget.
const MAX_IMAGES = 6;

type ImageInput = { base64: string; mediaType: Media };

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: {
    fields?: ExtractField[];
    image?: string;
    mediaType?: string;
    images?: { base64?: string; mediaType?: string }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fields = Array.isArray(body.fields) ? body.fields : [];
  // Accept either an `images` array (multi-photo) or a single legacy `image`.
  const rawImages = Array.isArray(body.images)
    ? body.images
    : typeof body.image === "string"
      ? [{ base64: body.image, mediaType: body.mediaType }]
      : [];

  if (!fields.length) return NextResponse.json({ error: "No fields" }, { status: 400 });
  if (!rawImages.length) return NextResponse.json({ error: "No image" }, { status: 400 });
  if (rawImages.length > MAX_IMAGES) {
    return NextResponse.json(
      { error: `Too many photos (max ${MAX_IMAGES})` },
      { status: 413 }
    );
  }

  const images: ImageInput[] = [];
  for (const img of rawImages) {
    const base64 = typeof img.base64 === "string" ? img.base64 : "";
    const mediaType = (img.mediaType ?? "image/jpeg") as string;
    if (!base64) return NextResponse.json({ error: "No image" }, { status: 400 });
    if (base64.length > MAX_BASE64) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }
    if (!ALLOWED_MEDIA.includes(mediaType as Media)) {
      return NextResponse.json({ error: "Unsupported image type" }, { status: 415 });
    }
    images.push({ base64, mediaType: mediaType as Media });
  }

  try {
    const values = await extractFieldsFromImage(fields, images);
    return NextResponse.json({ values });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
