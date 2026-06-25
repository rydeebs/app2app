import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AppSpecSchema, type AppSpec } from "@/lib/appSpec";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

function client() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

const SPEC_GUIDE = `
You convert a personal plan (Markdown) into an "AppSpec" JSON that a fixed runtime renders as an installable tracker app. You NEVER write code — only this JSON.

AppSpec shape:
{
  "name": string (<=40 chars, the app title),
  "tagline": string (<=80 chars, optional),
  "icon": { "emoji": string (a single emoji), "color": "#rrggbb" },
  "components": Component[]  // ordered top-to-bottom
}

Component types (use "type" as the discriminator). Every component needs a unique short "id".
1. markdown   { type, id, title?, content }                      // reference text from the plan
2. schedule   { type, id, title, items:[{id,date(YYYY-MM-DD),title,detail?}] }  // dated plan items
3. checklist  { type, id, title, repeat:"none"|"daily"|"weekly", items:[{id,label}] }
4. metric     { type, id, metricKey, title, unit?, start?, goal?, direction:"increase"|"decrease" }
              // direction "decrease" => lower is better (e.g. running pace, weight)
              // for time/pace values set unit to "duration" and express start/goal in seconds
5. logEntry   { type, id, title, metricKey, photoImport?:boolean, fields:[{key,label,kind:"number"|"text"|"duration",unit?}] }
              // metricKey MUST match a metric component's "metricKey"; lets the user record progress
              // set photoImport:true for fitness/run-style logs whose stats can be read off a
              // phone screenshot (Strava/Apple Fitness/Garmin) — the runtime lets the user import
              // a photo and auto-fills these fields.
6. reminder   { type, id, title, body, days:["mon".."sun"], time:"HH:MM" (24h) }

Rules:
- Always include at least one metric + one logEntry so the user can track progress toward the goal.
- The logEntry.metricKey must equal an existing metric.metricKey.
- The logEntry MUST contain one field whose "key" is exactly that same metricKey — this is the
  field carrying the tracked value. (e.g. metricKey "avg_pace_sec" => a field { key:"avg_pace_sec",
  kind:"duration", ... }.) Other fields (distance, notes, etc.) may use any keys.
- Pick a fitting emoji + a warm hex color for the icon.
- Use concrete dates for schedule items when the plan implies a timeline; otherwise prefer a checklist.
- Do NOT emit reminder components — the app automatically creates one alert covering every day
  that has activity, at a time the user chooses. Focus on the other component types.
- Keep it focused: 2-6 components.
`;

function extractJson(text: string): unknown {
  // Strip code fences and grab the outermost JSON object.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in model output");
  return JSON.parse(raw.slice(start, end + 1));
}

export type ClarifyingQuestion = { key: string; question: string };

export async function generateQuestions(
  md: string
): Promise<{ suggestedName: string; questions: ClarifyingQuestion[] }> {
  const msg = await client().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      "You help turn a personal plan into a tracker app. Ask only what's needed to build a great app. Return JSON only.",
    messages: [
      {
        role: "user",
        content: `Here is a plan in Markdown:\n\n<plan>\n${md}\n</plan>\n\nReturn JSON: { "suggestedName": string, "questions": [{ "key": string, "question": string }] }. Ask 2-4 short clarifying questions (e.g. start date, goal date, available days, units). Return JSON only.`,
      },
    ],
  });
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const parsed = extractJson(text) as { suggestedName?: string; questions?: ClarifyingQuestion[] };
  return {
    suggestedName: parsed.suggestedName || "My Plan",
    questions: Array.isArray(parsed.questions) ? parsed.questions.slice(0, 4) : [],
  };
}

export async function generateAppSpec(
  md: string,
  answers: Record<string, string>,
  today: string
): Promise<AppSpec> {
  const answersText = Object.entries(answers)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const userContent = `${SPEC_GUIDE}\n\nToday's date is ${today}.\n\n<plan>\n${md}\n</plan>\n\nUser answers to clarifying questions:\n${answersText || "(none)"}\n\nReturn ONLY the AppSpec JSON.`;

  const first = await client().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: "You output strictly valid AppSpec JSON and nothing else.",
    messages: [{ role: "user", content: userContent }],
  });
  let text = first.content.filter((b) => b.type === "text").map((b) => b.text).join("");

  let candidate: unknown;
  try {
    candidate = extractJson(text);
  } catch {
    candidate = {};
  }
  let result = AppSpecSchema.safeParse(candidate);
  if (result.success) return result.data;

  // One repair pass: hand the validation errors back to the model.
  const repair = await client().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: "You fix AppSpec JSON to satisfy the schema. Output ONLY corrected JSON.",
    messages: [
      { role: "user", content: userContent },
      { role: "assistant", content: text },
      {
        role: "user",
        content: `That JSON failed validation with these errors:\n${JSON.stringify(
          result.error.issues,
          null,
          2
        )}\nReturn corrected AppSpec JSON only.`,
      },
    ],
  });
  text = repair.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  result = AppSpecSchema.safeParse(extractJson(text));
  if (!result.success) {
    throw new Error("Generation failed validation: " + JSON.stringify(result.error.issues));
  }
  return result.data;
}

export type ExtractField = { key: string; label: string; kind: string; unit?: string };

/**
 * Read a photo (e.g. a run-tracker screenshot) and pull out values for the given
 * logEntry fields. Returns a { fieldKey: stringValue } map suitable for pre-filling
 * the runtime inputs. Values are strings; durations are "mm:ss", numbers are plain.
 */
export async function extractFieldsFromImage(
  fields: ExtractField[],
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp"
): Promise<Record<string, string>> {
  const fieldList = fields
    .map((f) => `- "${f.key}" (${f.label}${f.unit ? `, ${f.unit}` : ""}): ${f.kind}`)
    .join("\n");

  const instruction = `This image is a screenshot from a fitness/activity tracker. Read the stats and return JSON mapping each field key to its value as a string.

Fields:
${fieldList}

Output rules:
- Return ONLY a JSON object of { fieldKey: stringValue }.
- For "duration" fields use "mm:ss" (or "h:mm:ss"). For "number" fields use a plain number like "3.1". For "text" fields use the text.
- Omit any field whose value is not clearly visible in the image. Never guess.`;

  const msg = await client().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: "You extract structured data from images and return JSON only.",
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: instruction },
        ],
      },
    ],
  });

  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const parsed = extractJson(text) as Record<string, unknown>;
  const allowed = new Set(fields.map((f) => f.key));
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (allowed.has(k) && v != null && v !== "") out[k] = String(v);
  }
  return out;
}
