import { cn } from "@/lib/utils";
import { birdAsset } from "@/data/birds";
import type { BirdSpecies } from "@/lib/game/birds";
import { renderBirdArt, type BirdArt } from "@/lib/game/bird-art";
import type { Mood } from "@/lib/game/mood";
import { AccessoryOverlay } from "@/components/game/accessory-overlay";

/**
 * Renders a bird. Catalog species use their illustrated PNG sprite from
 * `/public/assets/birds/<id>.png`. Photographed "wild" birds (no asset) fall
 * back to the lightweight procedural SVG built from their palette. An equipped
 * accessory is overlaid on top.
 */
export function BirdSprite({
  species,
  size = 120,
  mood = "content",
  sleeping = false,
  accessoryKey = null,
  className,
}: {
  species: BirdSpecies;
  size?: number;
  animated?: boolean;
  mood?: Mood;
  sleeping?: boolean;
  accessoryKey?: string | null;
  className?: string;
}) {
  const asset = birdAsset(species.key);

  let content;
  if (asset) {
    content = (
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
  } else {
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
    content = (
      <svg width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label={species.name}>
        <g dangerouslySetInnerHTML={{ __html: inner }} />
      </svg>
    );
  }

  if (!accessoryKey) return content;
  return (
    <span className="relative inline-block" style={{ width: size, height: size }}>
      {content}
      <AccessoryOverlay accessoryKey={accessoryKey} size={size} />
    </span>
  );
}
