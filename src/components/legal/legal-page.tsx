import Link from "next/link";
import { Sunrise } from "lucide-react";
import type { ReactNode } from "react";
import { getLegalIdentity } from "@/lib/legal/identity";

export function LegalPage({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: ReactNode;
}) {
  const identity = getLegalIdentity();
  return (
    <main className="bg-sunrise-soft min-h-screen">
      <div className="mx-auto w-full max-w-3xl px-6 py-12">
        <header className="mb-10 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
            <span className="bg-sunrise shadow-soft flex h-9 w-9 items-center justify-center rounded-full">
              <Sunrise className="h-5 w-5 text-[#7a4a12]" aria-hidden />
            </span>
            Daybreak
          </Link>
          <Link href="/legal" className="text-muted-foreground hover:text-foreground text-sm">
            Legal documents
          </Link>
        </header>
        <article className="text-foreground/90 space-y-7 text-sm leading-relaxed">
          <div>
            <h1 className="text-foreground text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="text-muted-foreground mt-2">Effective: {effectiveDate}</p>
          </div>
          {children}
          <footer className="text-muted-foreground border-t pt-5 text-xs">
            Operator: {identity.operatorName}. Contact: {identity.supportEmail}.
          </footer>
        </article>
      </div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-foreground text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1 pl-5">{children}</ul>;
}
