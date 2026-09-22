import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app-nav";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { HealthKitAutoSync } from "@/components/healthkit-autosync";
import { AppExperience } from "@/components/app-experience";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("accent")
    .eq("id", user.id)
    .maybeSingle<{ accent: string | null }>();

  return (
    <div
      data-accent={profile?.accent ?? "sunrise"}
      className="bg-sunrise-soft flex min-h-screen flex-1 flex-col"
    >
      <AppExperience userId={user.id}>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <ServiceWorkerRegister />
        <HealthKitAutoSync />
        <AppNav />
        <main
          id="main-content"
          tabIndex={-1}
          className="app-main mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-[calc(6rem_+_env(safe-area-inset-bottom))] sm:px-6 md:pt-8 md:pb-10"
        >
          {children}
        </main>
      </AppExperience>
    </div>
  );
}
