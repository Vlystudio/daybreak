import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/settings/profile-form";
import { AccountCard } from "@/components/settings/account-card";
import { AccentPicker } from "@/components/settings/accent-picker";
import { AvatarUploader } from "@/components/settings/avatar-uploader";
import { loadUserProgress } from "@/lib/game/progress";
import { gatherAchievementStats, computeAchievements } from "@/lib/game/achievements";
import { StatsStrip } from "@/components/game/stats-strip";
import { AchievementsCard } from "@/components/profile/achievements-card";
import { Card, CardContent } from "@/components/ui/card";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, timezone, city, latitude, longitude, avatar_url, bio, accent")
    .eq("id", user.id)
    .maybeSingle<Profile & { accent: string | null }>();

  const name = profile?.display_name?.trim() || "Welcome";

  const progress = await loadUserProgress(user.id, profile?.timezone ?? "UTC");
  const achievements = computeAchievements(
    await gatherAchievementStats(user.id, progress.totalEarned, progress.dayStreak)
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1">You, your way.</p>
      </div>

      <Card className="bg-sunrise border-none text-[#5a3d1a]">
        <CardContent className="space-y-3 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-xl font-semibold">{name}</p>
              {profile?.city && <p className="text-sm opacity-80">{profile.city}</p>}
            </div>
          </div>
          <AvatarUploader
            avatarUrl={profile?.avatar_url ?? null}
            fallback={
              <span className="text-3xl font-semibold">{name.charAt(0).toUpperCase()}</span>
            }
          />
          {profile?.bio && <p className="text-sm leading-relaxed opacity-90">“{profile.bio}”</p>}
        </CardContent>
      </Card>

      <StatsStrip
        level={progress.level}
        intoLevel={progress.intoLevel}
        span={progress.span}
        seeds={progress.seeds}
        dayStreak={progress.dayStreak}
      />
      <AchievementsCard achievements={achievements} />

      <ProfileForm profile={profile ?? null} />
      <AccentPicker current={profile?.accent ?? "sunrise"} />
      <AccountCard email={user.email ?? ""} />
    </div>
  );
}
