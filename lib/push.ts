import "server-only";
import webpush from "web-push";

let configured = false;

export function getWebPush() {
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@example.com",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    configured = true;
  }
  return webpush;
}

export type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function sendPush(
  sub: PushSub,
  payload: { title: string; body: string; url?: string; icon?: string }
): Promise<{ ok: boolean; gone?: boolean }> {
  try {
    await getWebPush().sendNotification(sub, JSON.stringify(payload));
    return { ok: true };
  } catch (e: unknown) {
    const code = (e as { statusCode?: number }).statusCode;
    // 404/410 => subscription expired and should be removed.
    return { ok: false, gone: code === 404 || code === 410 };
  }
}
