import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { integrationsAvailable } from "@/env";
import { sendPushToUser } from "@/lib/push";
import { activeDeals, matchFavoritesToDeals } from "@/lib/grocery/on-sale";

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

  let notified = 0;
  for (const s of settings ?? []) {
    const favorites = Array.isArray(s.favorites) ? s.favorites : [];
    if (favorites.length === 0) continue;

    const matches = matchFavoritesToDeals(favorites, deals);
    if (matches.length === 0) continue;

    const lead = matches[0];
    const extra = matches.length - 1;
    const body =
      `${lead.favorite} is on sale${lead.store ? ` at ${lead.store}` : ""}` +
      (extra > 0 ? ` (+${extra} more of your favorites)` : "") + ".";

    const sent = await sendPushToUser(s.user_id, {
      title: "🏷️ Your groceries are on sale",
      body,
      url: "/grocery/prices",
    });
    if (sent > 0) notified++;
  }
  return notified;
}
