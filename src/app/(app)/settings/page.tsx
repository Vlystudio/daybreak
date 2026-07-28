import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadDashboardData } from "@/lib/dashboard-data";
import { createClient } from "@/lib/supabase/server";
import { integrationsAvailable } from "@/env";
import { NotificationsCard } from "@/components/settings/notifications-card";
import { RemindersCard } from "@/components/settings/reminders-card";
import { HealthImportCard } from "@/components/settings/health-import-card";
import { DataPrivacyCard } from "@/components/settings/data-privacy-card";
import { MfaCard } from "@/components/settings/mfa-card";
import { CalendarSyncCard } from "@/components/dashboard/calendar-sync-card";
import { HealthSourcesCard } from "@/components/settings/health-sources-card";
import { AiDataUseCard } from "@/components/settings/ai-data-use-card";
import { HEALTH_PROVIDERS, providerState } from "@/lib/health/providers";
import { aiConsentFromPrefs, type AiConsentPreferences } from "@/lib/integrations/ai-consent";
import type { Reminder } from "@/lib/types";
import { HouseholdCard } from "@/components/dashboard/household-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, UserRound, ChevronRight, FileText, LifeBuoy } from "lucide-react";
import { SOCIAL_FEATURES_ENABLED } from "@/lib/features";
import { getLegalIdentity } from "@/lib/legal/identity";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const legalIdentity = getLegalIdentity();
  const data = await loadDashboardData(user.id);

  const supabase = await createClient();
  const [{ data: notif }, { data: reminders }, { data: appleImport }, { data: aiPrefs }] =
    await Promise.all([
      supabase
        .from("notification_settings")
        .select("morning_email_enabled")
        .eq("user_id", user.id)
        .maybeSingle<{ morning_email_enabled: boolean }>(),
      supabase
        .from("reminders")
        .select("id, kind, hour, message, enabled")
        .eq("user_id", user.id)
        .order("hour", { ascending: true })
        .returns<Reminder[]>(),
      supabase
        .from("apple_health_imports")
        .select("metrics_days, range_end")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ metrics_days: number; range_end: string | null }>(),
      supabase
        .from("user_preferences")
        .select(
          "allow_ai_basic_processing, allow_ai_tasks_context, allow_ai_health_context, allow_ai_calendar_availability, allow_ai_calendar_detail, allow_ai_checkin_context, allow_ai_profile_context, allow_ai_uploads, ai_consent_version, ai_consent_updated_at, ai_consent_expires_at"
        )
        .eq("user_id", user.id)
        .maybeSingle<AiConsentPreferences>(),
    ]);
  const aiConsent = aiConsentFromPrefs(aiPrefs);
  const morningEmailEnabled = notif?.morning_email_enabled ?? true;
  const pushAvailable = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);

  // Provider registry → per-user state for the health-sources overview.
  const connectedProviders = new Set<string>(data.connections.map((c) => c.provider));
  const fitbitConfigured = integrationsAvailable.fitbit();
  // The registry contains only supported V1 sources.
  const healthSources = HEALTH_PROVIDERS.filter((p) => p.status === "active").map((p) => {
    const connected =
      p.id === "apple_health"
        ? Boolean(appleImport)
        : p.id === "manual"
          ? false
          : connectedProviders.has(p.id);
    const configured = p.id === "fitbit" ? fitbitConfigured : undefined;
    return {
      id: p.id,
      label: p.label,
      description: p.description,
      note: p.note,
      state: providerState(p, { connected, configured }),
    };
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Make Daybreak feel like yours.</p>
      </div>

      <Link href="/profile" className="block">
        <Card className="hover:border-primary/40 transition-colors">
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <span className="flex items-center gap-3">
              <UserRound className="text-primary h-5 w-5" aria-hidden />
              <span>
                <span className="block text-sm font-medium">Profile &amp; personalization</span>
                <span className="text-muted-foreground block text-xs">
                  Name, city, accent theme, account
                </span>
              </span>
            </span>
            <ChevronRight className="text-muted-foreground h-4 w-4" aria-hidden />
          </CardContent>
        </Card>
      </Link>

      <NotificationsCard morningEmailEnabled={morningEmailEnabled} />
      <RemindersCard reminders={reminders ?? []} pushAvailable={pushAvailable} />
      <CalendarSyncCard
        connections={data.connections}
        calendarSync={data.calendarSync}
        fitbitAvailable={integrationsAvailable.fitbit()}
        appleHealth={{
          connected: Boolean(appleImport),
          lastRangeEnd: appleImport?.range_end ?? null,
        }}
      />
      <HealthImportCard />
      <HealthSourcesCard sources={healthSources} />
      <AiDataUseCard
        consent={aiConsent}
        updatedAt={aiPrefs?.ai_consent_updated_at ?? null}
        expiresAt={aiPrefs?.ai_consent_expires_at ?? null}
      />
      {SOCIAL_FEATURES_ENABLED && <HouseholdCard household={data.household} householdEvents={[]} />}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="text-sage h-5 w-5" aria-hidden />
            Your data
          </CardTitle>
          <CardDescription>How Daybreak protects your health information</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>· Every record is protected by row-level security — only you can read your data.</p>
          <p>· OAuth tokens are encrypted at rest with AES-256-GCM and never leave the server.</p>
          <p>
            · AI processing is off until you opt in. Each optional data category is controlled
            separately, and only categories needed for the feature you request may be sent.
          </p>
          <p>· Disconnecting a provider immediately deletes its tokens.</p>
        </CardContent>
      </Card>

      <MfaCard />
      <DataPrivacyCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="text-primary h-5 w-5" aria-hidden /> Legal &amp; support
          </CardTitle>
          <CardDescription>Policies, help, export, and account controls.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Link className="text-primary block underline" href="/privacy">
            Privacy Policy
          </Link>
          <Link className="text-primary block underline" href="/terms">
            Terms of Service
          </Link>
          <a
            className="text-primary flex items-center gap-2 underline"
            href={`mailto:${legalIdentity.supportEmail}`}
          >
            <LifeBuoy className="h-4 w-4" aria-hidden /> Contact support
          </a>
          <a className="text-primary block underline" href="#data-privacy">
            Export or delete my data
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
