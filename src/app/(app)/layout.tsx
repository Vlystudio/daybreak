import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app-nav";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("accent")
    .eq("id", user.id)
    .maybeSingle<{ accent: string | null }>();

  return (
    <div data-accent={profile?.accent ?? "sunrise"} className="bg-sunrise-soft flex min-h-screen flex-1 flex-col">
      <ServiceWorkerRegister />
      <AppNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-10">
        {children}
      </main>
    </div>
  );
}
