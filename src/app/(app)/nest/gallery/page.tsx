import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BIRDS } from "@/data/birds";

export const metadata = { title: "Bird Gallery · Daybreak" };

const RARITY_COLOR: Record<string, string> = {
  common: "#8a9099",
  uncommon: "#3f9d5a",
  rare: "#3b7fd2",
  legendary: "#b5862f",
};

// Inspection screen for all 60 illustrated species (read from the manifest).
export default function BirdGalleryPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bird Gallery</h1>
          <p className="mt-1 text-sm text-muted-foreground">All {BIRDS.length} species · {BIRDS.length} sprites from the manifest.</p>
        </div>
        <Link href="/nest" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Nest
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {BIRDS.map((b) => (
          <div key={b.id} className="flex flex-col items-center rounded-2xl border border-border bg-card p-3 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.asset} alt={b.commonName} width={128} height={128} className="h-28 w-28 object-contain" />
            <p className="mt-1.5 text-xs font-medium leading-tight">{b.commonName}</p>
            <p className="text-[10px] italic text-muted-foreground">{b.scientificName}</p>
            <span
              className="mt-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white"
              style={{ background: RARITY_COLOR[b.rarityTier] ?? "#8a9099" }}
            >
              {b.rarityTier}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
