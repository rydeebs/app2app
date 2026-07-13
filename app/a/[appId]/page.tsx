import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppSpecSchema } from "@/lib/appSpec";
import { isHtmlApp } from "@/lib/htmlApp";
import { AppRenderer } from "@/components/runtime/AppRenderer";
import { InstallPrompt } from "@/components/InstallPrompt";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ appId: string }>;
}): Promise<Metadata> {
  const { appId } = await params;
  const admin = createAdminClient();
  const { data } = await admin.from("apps").select("name, icon").eq("id", appId).single();
  const name = data?.name || "Tracker";
  const color = (data?.icon as { color?: string })?.color || "#9b86d4";

  return {
    title: name,
    manifest: `/a/${appId}/manifest.webmanifest`,
    themeColor: color,
    appleWebApp: { capable: true, statusBarStyle: "default", title: name },
    icons: { apple: `/api/icon/${appId}?size=180` },
  };
}

export default async function AppPage({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  const { appId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20 text-center">
        <p className="text-foreground">Please sign in to view this app.</p>
        <Link href="/login" className="mt-4 inline-block text-primary underline">
          Sign in
        </Link>
      </main>
    );
  }

  const { data: app } = await supabase
    .from("apps")
    .select("id, app_spec")
    .eq("id", appId)
    .single();

  if (!app) notFound();

  // Imported HTML apps render verbatim in a sandboxed iframe rather than through
  // the AppSpec runtime. allow-same-origin is required for the file's own
  // localStorage to work; the /raw route that feeds it is owner-gated.
  if (isHtmlApp(app.app_spec)) {
    return (
      <main className="flex min-h-screen flex-col">
        <div className="px-4 py-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-foreground"
          >
            ‹ Your apps
          </Link>
        </div>
        <iframe
          src={`/a/${app.id}/raw`}
          title="Imported app"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          className="h-[calc(100vh-3rem)] w-full border-0"
        />
        <InstallPrompt />
      </main>
    );
  }

  const parsed = AppSpecSchema.safeParse(app.app_spec);
  if (!parsed.success) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20 text-center text-danger">
        This app&apos;s data is invalid.
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <AppRenderer appId={app.id} spec={parsed.data} />
      <InstallPrompt />
    </main>
  );
}
