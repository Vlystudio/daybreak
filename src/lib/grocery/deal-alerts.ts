import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { integrationsAvailable } from "@/env";
import { sendPushToUser } from "@/lib/push";
import { mapWithConcurrency } from "@/lib/concurrency";
import { activeDeals, matchFavoritesToDeals } from "@/lib/grocery/on-sale";
import { errorClass, safeLog } from "@/lib/security/safe-logger";

/**
 * After a deal refresh, push each user a heads-up when their favorite grocery
 * items are on sale this week. Best-effort and gated on push being configured.
 * Called from the morning cron, once per day, right after the deal import.
 */
export async function notifyFavoriteDeals(): Promise<number> {
  if (!integrationsAvailable.push()) return 0;

  const deals = await activeDeals();
  if (deals.length === 0) return 0;

  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("grocery_settings")
    .select("user_id, favorites")
    .returns<{ user_id: string; favorites: string[] | null }[]>();

  // Push each match concurrently (was one user at a time) so a daily fan-out
  // across many users doesn't serialize into a long, timeout-prone run.
  const results = await mapWithConcurrency(settings ?? [], 10, async (s) => {
    const favorites = Array.isArray(s.favorites) ? s.favorites : [];
    if (favorites.length === 0) return false;

    const matches = matchFavoritesToDeals(favorites, deals);
    if (matches.length === 0) return false;

    const lead = matches[0];
    const extra = matches.length - 1;
    const body =
      `${lead.favorite} is on sale${lead.store ? ` at ${lead.store}` : ""}` +
      (extra > 0 ? ` (+${extra} more of your favorites)` : "") +
      ".";

    const sent = await sendPushToUser(s.user_id, {
      title: "🏷️ Your groceries are on sale",
      body,
      url: "/grocery/prices",
    });
    return sent > 0;
  });

  let notified = 0;
  for (const r of results) {
    if (r.status === "fulfilled") {
      if (r.value) notified++;
    } else {
      safeLog("error", "deal_alerts.push_failed", { errorClass: errorClass(r.reason) });
    }
  }
  return notified;
}
