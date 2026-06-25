/**
 * Trim + validate a required env var. Pass the *literal* `process.env.X` so Next can still
 * statically inline `NEXT_PUBLIC_*` values into the client bundle. Trimming guards against a
 * trailing newline/space pasted into the host's env UI, which otherwise makes Supabase's internal
 * `new URL(url)` throw during render (the opaque "Server Components render" error).
 */
export function requireEnv(value: string | undefined, name: string): string {
  const v = (value ?? "").trim();
  if (!v) throw new Error(`Missing or blank environment variable: ${name}`);
  return v;
}
