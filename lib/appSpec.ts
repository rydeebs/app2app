import { z } from "zod";

/**
 * AppSpec is the contract between the LLM generator and the runtime renderer.
 * The model never emits code — only a validated AppSpec against this fixed
 * component vocabulary. This guarantees every generated app is renderable,
 * persistent, and notification-capable.
 */

const DayEnum = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

// Optional grouping label. When set, the runtime groups components into a tab
// bar (e.g. "Today", "Progress", "Plan"). Apps without tabs render as one feed.
const tab = z.string().optional();

const MarkdownComponent = z.object({
  type: z.literal("markdown"),
  id: z.string(),
  tab,
  title: z.string().optional(),
  content: z.string(),
});

const ScheduleComponent = z.object({
  type: z.literal("schedule"),
  id: z.string(),
  tab,
  title: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      date: z.string(), // YYYY-MM-DD
      title: z.string(),
      detail: z.string().optional(),
    })
  ),
});

const ChecklistComponent = z.object({
  type: z.literal("checklist"),
  id: z.string(),
  tab,
  title: z.string(),
  repeat: z.enum(["none", "daily", "weekly"]).default("none"),
  items: z.array(z.object({ id: z.string(), label: z.string() })),
});

const MetricComponent = z.object({
  type: z.literal("metric"),
  id: z.string(),
  tab,
  metricKey: z.string(), // referenced by logEntry + app_logs.metric_key
  title: z.string(),
  unit: z.string().optional(),
  start: z.number().optional(),
  goal: z.number().optional(),
  // "decrease" => lower is better (e.g. running pace); "increase" => higher is better
  direction: z.enum(["increase", "decrease"]).default("increase"),
});

const LogEntryComponent = z.object({
  type: z.literal("logEntry"),
  id: z.string(),
  tab,
  title: z.string(),
  metricKey: z.string(), // ties the logged value to a MetricComponent.key
  // When true, the runtime offers "Import from photo" — Claude vision reads a
  // screenshot (e.g. a run summary) and pre-fills these fields for review.
  photoImport: z.boolean().default(false),
  fields: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      kind: z.enum(["number", "text", "duration", "date"]).default("number"),
      unit: z.string().optional(),
    })
  ),
});

const ReminderComponent = z.object({
  type: z.literal("reminder"),
  id: z.string(),
  tab,
  title: z.string(),
  body: z.string(),
  days: z.array(DayEnum).min(1),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), // HH:MM 24h
});

export const ComponentSchema = z.discriminatedUnion("type", [
  MarkdownComponent,
  ScheduleComponent,
  ChecklistComponent,
  MetricComponent,
  LogEntryComponent,
  ReminderComponent,
]);

export const AppSpecSchema = z.object({
  name: z.string().min(1).max(40),
  tagline: z.string().max(80).optional(),
  icon: z.object({
    emoji: z.string().min(1).max(8),
    color: z
      .string()
      .regex(/^#([0-9a-fA-F]{6})$/)
      .default("#9b86d4"),
  }),
  components: z.array(ComponentSchema).min(1),
});

export type AppSpec = z.infer<typeof AppSpecSchema>;
export type AppComponent = z.infer<typeof ComponentSchema>;
export type DayKey = z.infer<typeof DayEnum>;
export const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
