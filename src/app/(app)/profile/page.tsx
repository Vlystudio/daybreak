import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/settings/profile-form";
import { AccountCard } from "@/components/settings/account-card";
import { AccentPicker } from "@/components/settings/accent-picker";
import { AvatarUploader } from "@/components/settings/avatar-uploader";
import { BirdSprite } from "@/components/game/bird-sprite";
import { resolveSpecies, type OwnedBirdBase } from "@/lib/game/birds";
import { Card, CardContent } from "@/components/ui/card";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: profile }, { data: gameRow }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, timezone, city, latitude, longitude, avatar_url, bio, accent")
      .eq("id", user.id)
      .maybeSingle<Profile & { accent: string | null }>(),
    supabase
      .from("user_game")
      .select(
        "active_bird:user_birds!user_game_active_bird_id_fkey(species_key, source, nickname, custom_name, custom_blurb, custom_palette, custom_crest, custom_long_tail)"
      )
      .eq("user_id", user.id)
      .maybeSingle<{ active_bird: (OwnedBirdBase & { nickname: string | null }) | null }>(),
  ]);

  const bird = gameRow?.active_bird ?? null;
  const species = bird ? resolveSpecies(bird) : null;
  const name = profile?.display_name?.trim() || "Welcome";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-muted-foreground">You, your way.</p>
      </div>

      <Card className="bg-sunrise border-none text-[#5a3d1a]">
        <CardContent className="space-y-3 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-xl font-semibold">{name}</p>
              <p className="text-sm opacity-80">
                {bird ? `with ${bird.nickname || species?.name}` : "Hatch a companion in your Nest"}
                {profile?.city ? ` · ${profile.city}` : ""}
              </p>
            </div>
            {species && (
              <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/40 sm:flex">
                <BirdSprite species={species} size={52} />
              </span>
            )}
          </div>
          <AvatarUploader
            avatarUrl={profile?.avatar_url ?? null}
            fallback={species ? <BirdSprite species={species} size={72} /> : <span className="text-3xl">🥚</span>}
          />
          {profile?.bio && <p className="text-sm leading-relaxed opacity-90">“{profile.bio}”</p>}
        </CardContent>
      </Card>

      <ProfileForm profile={profile ?? null} />
      <AccentPicker current={profile?.accent ?? "sunrise"} />
      <AccountCard email={user.email ?? ""} />
    </div>
  );
}
