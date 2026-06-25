import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native iOS shell for Shelf. The WKWebView loads the live Next.js deployment
 * (server.url) while the Capacitor bridge injects native plugins (local
 * notifications, app lifecycle). This keeps 100% of the web codebase and lets
 * the same app ship to TestFlight.
 *
 * Set CAP_SERVER_URL to your Vercel production URL before `npx cap sync`.
 * `allowNavigation` must include the Supabase auth host so OAuth/email
 * confirmation redirects stay inside the app instead of bouncing to Safari.
 */
const serverUrl = process.env.CAP_SERVER_URL || "https://shelf.vercel.app";

const config: CapacitorConfig = {
  appId: "app.shelf.mobile",
  appName: "Shelf",
  webDir: "public",
  server: {
    url: serverUrl,
    cleartext: false,
    allowNavigation: ["*.supabase.co", "*.vercel.app"],
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
