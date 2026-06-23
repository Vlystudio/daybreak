import { cn } from "@/lib/utils";
import { birdAsset } from "@/data/birds";
import type { BirdSpecies } from "@/lib/game/birds";
import { renderBirdArt, type BirdArt } from "@/lib/game/bird-art";
import type { Mood } from "@/lib/game/mood";

/**
 * Renders a bird. Catalog species use their illustrated PNG sprite from
 * `/public/assets/birds/<id>.png`. Photographed "wild" birds (no asset) fall
 * back to the lightweight procedural SVG built from their palette.
 */
export function BirdSprite({
  species,
  size = 120,
  mood = "content",
  sleeping = false,
  className,
}: {
  species: BirdSpecies;
  size?: number;
  animated?: boolean;
  mood?: Mood;
  sleeping?: boolean;
  className?: string;
}) {
  const asset = birdAsset(species.key);
  if (asset) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={asset}
        alt={species.name}
        width={size}
        height={size}
        draggable={false}
        className={cn("select-none object-contain", sleeping && "opacity-90 saturate-[0.85]", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  // Wild / photographed birds: procedural SVG from palette.
  const uid = species.key.replace(/[^a-z0-9]/gi, "") || "x";
  const art: BirdArt = species.art ?? {
    template: "perch",
    bill: "cone",
    crest: species.crest ? "spike" : "none",
    tail: species.longTail ? "long" : "medium",
    legs: "short",
    marks: [],
  };
  const inner = renderBirdArt(species.palette, art, { uid, mood, sleeping });
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label={species.name}>
      <g dangerouslySetInnerHTML={{ __html: inner }} />
    </svg>
  );
}
