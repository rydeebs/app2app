import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";

/**
 * Service-role client. SERVER ONLY — bypasses RLS. Never import into client code.
 * Used by the cron endpoint to read reminders / push subscriptions across users.
 */
export function createAdminClient() {
  return createClient(
    requireEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
