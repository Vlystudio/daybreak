import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv, publicEnv, integrationsAvailable } from "@/env";
import { sanitizeNotificationUrl } from "@/lib/security/safe-url";
import { errorClass, safeLog } from "@/lib/security/safe-logger";
import { isProcessorEnabled } from "@/lib/privacy/processors";

/**
 * Web Push delivery. Sends to every subscription a user has registered and
 * prunes endpoints the push service reports as gone (404/410). No-ops when
 * VAPID keys aren't configured, so the app runs fine without push set up.
 */

let configured = false;
function ensureConfigured(): boolean {
  if (!integrationsAvailable.push() || !isProcessorEnabled("web_push")) return false;
  if (!configured) {
    webpush.setVapidDetails(
      serverEnv().VAPID_SUBJECT,
      publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      serverEnv().VAPID_PRIVATE_KEY!
    );
    configured = true;
  }
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Send a push to all of a user's devices. Returns the number delivered. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!ensureConfigured()) return 0;

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId)
    .returns<SubscriptionRow[]>();

  if (!subs || subs.length === 0) return 0;

  // Force the click target to a safe same-origin path before it ever reaches a
  // device (defense in depth — the service worker sanitizes again on click).
  const body = JSON.stringify({ ...payload, url: sanitizeNotificationUrl(payload.url) });
  let delivered = 0;
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        );
        delivered++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.id);
        else
          safeLog("error", "push.send_failed", {
            errorClass: errorClass(err),
            httpStatus: status ?? 0,
          });
      }
    })
  );

  if (dead.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", dead);
  }
  return delivered;
}
