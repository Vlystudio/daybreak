import { requireUser } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <div className="bg-sunrise-soft flex min-h-screen flex-1 flex-col">
      <ServiceWorkerRegister />
      <AppNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-10">
        {children}
      </main>
    </div>
  );
}
