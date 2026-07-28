import { requireUser } from "@/lib/auth";
import { loadFriends } from "@/lib/friends";
import { loadCompetitions } from "@/lib/competitions";
import { FriendsView } from "@/components/friends/friends-view";
import { CompetitionsView } from "@/components/friends/competitions-view";
import { notFound } from "next/navigation";
import { SOCIAL_FEATURES_ENABLED } from "@/lib/features";

export const metadata = { title: "Friends" };
export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  if (!SOCIAL_FEATURES_ENABLED) notFound();
  const user = await requireUser();
  const [data, competitions] = await Promise.all([loadFriends(user.id), loadCompetitions(user.id)]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Friends</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Connect with friends, choose exactly what you share, and challenge each other.
        </p>
      </div>
      <FriendsView data={data} />
      <CompetitionsView
        competitions={competitions}
        friends={data.friends.map((f) => ({ userId: f.userId, name: f.name }))}
      />
    </div>
  );
}
