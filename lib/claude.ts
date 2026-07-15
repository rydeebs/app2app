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
Every component may also include an optional "tab" string (see Tabs below).
1. markdown   { type, id, tab?, title?, content }                // reference text from the plan
2. schedule   { type, id, tab?, title, items:[{id,date(YYYY-MM-DD),title,detail?}] }  // dated plan items
3. checklist  { type, id, tab?, title, repeat:"none"|"daily"|"weekly", items:[{id,label}] }
4. metric     { type, id, tab?, metricKey, title, unit?, start?, goal?, direction:"increase"|"decrease" }
              // direction "decrease" => lower is better (e.g. running pace, weight)
              // for time/pace values set unit to "duration" and express start/goal in seconds
5. logEntry   { type, id, tab?, title, metricKey, photoImport?:boolean, fields:[{key,label,kind:"number"|"text"|"duration"|"date",unit?}] }
              // metricKey MUST match a metric component's "metricKey"; lets the user record progress
              // field kind "date" renders a calendar picker (value "YYYY-MM-DD") — use it whenever a
              // log needs the user to pick a specific day.
              // set photoImport:true for fitness/run-style logs whose stats can be read off a
              // phone screenshot (Strava/Apple Fitness/Garmin) — the runtime lets the user import
              // one or more photos and auto-fills these fields.
6. reminder   { type, id, tab?, title, body, days:["mon".."sun"], time:"HH:MM" (24h) }
7. plan       { type, id, tab?, title, weeks:[{ number, theme?, days:[{ day, items:[string] }] }] }
              // a multi-week program. Renders a week selector (dropdown + prev/next) where each
              // week is its own schedule with its OWN saved checkmarks, progress bar, and notes.

Multi-week programs:
- For ANY plan that spans multiple weeks (training programs, courses, challenges, bootcamps), emit
  ONE "plan" component with a "weeks" array — one entry per week, each carrying its own "days" and
  "items". Do NOT flatten the weeks into a dated "schedule", and do NOT create one tab per week
  (the built-in week selector handles navigation).
- Give EACH week all seven days in order — "Mon","Tue","Wed","Thu","Fri","Sat","Sun" — even rest
  days (use an item like "Rest — light walk / mobility"). Never truncate a week to just a few days.
- Put each session/task as a plain string in "items". Set "theme" to that week's focus or phase when
  the plan has one (e.g. "Recovery week").
- Give the whole plan a single tab such as "Plan".

Tabs (for a cleaner layout):
- Give every component a short "tab" label so the runtime groups them into a tab bar instead of one
  long scroll. Use 2-4 distinct tabs total (e.g. "Today", "Progress", "Plan", "Guide").
- Keep related components in the same tab (e.g. metric + its logEntry together under "Progress";
  reference markdown under "Guide"; schedule/checklist under "Plan").
- Use the SAME exact spelling for tabs that belong together. Tabs are optional for very small apps.

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

export type QuestionType =
  | "select"
  | "multiselect"
  | "date"
  | "daterange"
  | "number"
  | "text";

export type ClarifyingQuestion = {
  key: string;
  question: string;
  type: QuestionType;
  options?: string[]; // for select / multiselect
  unit?: string; // for number (e.g. "miles", "lbs")
};

const QUESTION_TYPES: QuestionType[] = [
  "select",
  "multiselect",
  "date",
  "daterange",
  "number",
  "text",
];

// Coerce a raw model-emitted question into a valid, renderable shape. Unknown
// types fall back to free text; choice types without real options degrade to text.
function normalizeQuestion(raw: unknown): ClarifyingQuestion | null {
  if (typeof raw !== "object" || raw === null) return null;
  const q = raw as Record<string, unknown>;
  const key = typeof q.key === "string" ? q.key : "";
  const question = typeof q.question === "string" ? q.question : "";
  if (!key || !question) return null;

  let type: QuestionType = QUESTION_TYPES.includes(q.type as QuestionType)
    ? (q.type as QuestionType)
    : "text";

  let options: string[] | undefined;
  if (type === "select" || type === "multiselect") {
    options = Array.isArray(q.options)
      ? q.options.filter((o): o is string => typeof o === "string" && o.trim().length > 0).slice(0, 8)
      : undefined;
    if (!options || options.length < 2) type = "text"; // not enough choices to be a picklist
  }

  const unit = type === "number" && typeof q.unit === "string" ? q.unit : undefined;

  return { key, question, type, ...(options ? { options } : {}), ...(unit ? { unit } : {}) };
}

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
        content: `Here is a plan in Markdown:\n\n<plan>\n${md}\n</plan>\n\nReturn JSON: { "suggestedName": string, "questions": ClarifyingQuestion[] } where each question is { "key": string, "question": string, "type": "select"|"multiselect"|"date"|"daterange"|"number"|"text", "options"?: string[], "unit"?: string }.

Ask 2-4 short clarifying questions and pick the BEST input type for each so the user taps instead of typing:
- "date" for a single date/deadline (e.g. race day, exam date).
- "daterange" for a span (e.g. the training window, program start-to-end).
- "select" for a fixed set of choices (e.g. goal type, experience level, units) — give 3-6 "options".
- "multiselect" for choosing several (e.g. which days of the week you train) — give the "options" (use Mon,Tue,Wed,Thu,Fri,Sat,Sun for weekdays).
- "number" for a quantity, with a "unit" (e.g. "miles", "lbs", "minutes").
- "text" ONLY when none of the above fit.
Options must be concrete recognizable values. Return JSON only.`,
      },
    ],
  });
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const parsed = extractJson(text) as { suggestedName?: string; questions?: unknown[] };
  const questions = Array.isArray(parsed.questions)
    ? parsed.questions
        .map(normalizeQuestion)
        .filter((q): q is ClarifyingQuestion => q !== null)
        .slice(0, 4)
    : [];
  return {
    suggestedName: parsed.suggestedName || "My Plan",
    questions,
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

  const userContent = `Today's date is ${today}.\n\n<plan>\n${md}\n</plan>\n\nUser answers to clarifying questions:\n${answersText || "(none)"}\n\nReturn ONLY the AppSpec JSON.`;

  // Cache the large static spec guide as a shared prefix so the repair pass and
  // any subsequent builds within a few minutes reuse it (lower latency + cost).
  const guideBlock = {
    type: "text" as const,
    text: SPEC_GUIDE,
    cache_control: { type: "ephemeral" as const },
  };

  // A full multi-week plan can be large. A too-small token cap truncated the JSON,
  // which failed validation and forced a slow, wasteful second (repair) call — the
  // main cause of long "building" waits. A generous cap lets the first pass finish
  // in one shot, and streaming keeps the long request alive instead of buffering.
  const first = await client()
    .messages.stream({
      model: MODEL,
      max_tokens: 16000,
      system: [guideBlock, { type: "text", text: "You output strictly valid AppSpec JSON and nothing else." }],
      messages: [{ role: "user", content: userContent }],
    })
    .finalMessage();
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
  const repair = await client()
    .messages.stream({
      model: MODEL,
      max_tokens: 16000,
      system: [guideBlock, { type: "text", text: "You fix AppSpec JSON to satisfy the schema. Output ONLY corrected JSON." }],
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
    })
    .finalMessage();
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
type ExtractImage = { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };

export async function extractFieldsFromImage(
  fields: ExtractField[],
  images: ExtractImage[]
): Promise<Record<string, string>> {
  const fieldList = fields
    .map((f) => `- "${f.key}" (${f.label}${f.unit ? `, ${f.unit}` : ""}): ${f.kind}`)
    .join("\n");

  const multiple = images.length > 1;
  const instruction = `${
    multiple
      ? "These images are photos/screenshots of the same activity or log. Combine the information across all of them; if a value appears in more than one image, prefer the clearest reading."
      : "This image is a screenshot from a fitness/activity tracker."
  } Read the stats and return JSON mapping each field key to its value as a string.

Fields:
${fieldList}

Output rules:
- Return ONLY a JSON object of { fieldKey: stringValue }.
- For "duration" fields use "mm:ss" (or "h:mm:ss"). For "number" fields use a plain number like "3.1". For "date" fields use "YYYY-MM-DD". For "text" fields use the text.
- Omit any field whose value is not clearly visible. Never guess.`;

  const imageBlocks = images.map((img) => ({
    type: "image" as const,
    source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 },
  }));

  const msg = await client().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: "You extract structured data from images and return JSON only.",
    messages: [
      {
        role: "user",
        content: [...imageBlocks, { type: "text", text: instruction }],
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
