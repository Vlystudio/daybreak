import { requireUser } from "@/lib/auth";
import { loadDashboardData } from "@/lib/dashboard-data";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/settings/profile-form";
import { AccountCard } from "@/components/settings/account-card";
import { NotificationsCard } from "@/components/settings/notifications-card";
import { CalendarSyncCard } from "@/components/dashboard/calendar-sync-card";
import { HouseholdCard } from "@/components/dashboard/household-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const data = await loadDashboardData(user.id);

  const supabase = await createClient();
  const { data: notif } = await supabase
    .from("notification_settings")
    .select("morning_email_enabled")
    .eq("user_id", user.id)
    .maybeSingle<{ morning_email_enabled: boolean }>();
  const morningEmailEnabled = notif?.morning_email_enabled ?? true;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">Make Daybreak feel like yours.</p>
      </div>

      <ProfileForm profile={data.profile} />
      <AccountCard email={user.email ?? ""} />
      <NotificationsCard morningEmailEnabled={morningEmailEnabled} />
      <CalendarSyncCard connections={data.connections} calendarSync={data.calendarSync} />
      <HouseholdCard household={data.household} householdEvents={[]} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-sage" aria-hidden />
            Your data
          </CardTitle>
          <CardDescription>How Daybreak protects your health information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>· Every record is protected by row-level security — only you can read your data.</p>
          <p>· OAuth tokens are encrypted at rest with AES-256-GCM and never leave the server.</p>
          <p>
            · Your health metrics are sent to OpenAI solely to write your morning briefing, and are
            never used for anything else.
          </p>
          <p>· Disconnecting a provider immediately deletes its tokens.</p>
        </CardContent>
      </Card>
    </div>
  );
}
