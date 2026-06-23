import type { BirdSpecies } from "@/lib/game/birds";
import { renderBirdArt, type BirdArt } from "@/lib/game/bird-art";
import type { Mood } from "@/lib/game/mood";

/**
 * Renders a species' `art` recipe (silhouette template + field marks) into a
 * unique SVG via the bird-art engine — the same builder that produces the
 * exported .svg/.png assets, so what you see in-app is the asset. Photographed
 * "wild" birds have no recipe, so they fall back to a generic perched body
 * built from their palette + crest/long-tail flags.
 */
export function BirdSprite({
  species,
  size = 120,
  animated = true,
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
  const uid = species.key.replace(/[^a-z0-9]/gi, "") || "x";
  const art: BirdArt = species.art ?? fallbackArt(species);
  const inner = renderBirdArt(species.palette, art, { uid, mood, sleeping, animated });

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label={species.name}>
      <g
        className={animated && !sleeping ? "bird-bob" : undefined}
        style={{ transformOrigin: "50px 92px" }}
        dangerouslySetInnerHTML={{ __html: inner }}
      />
    </svg>
  );
}

function fallbackArt(species: BirdSpecies): BirdArt {
  return {
    template: "perch",
    bill: "cone",
    crest: species.crest ? "spike" : "none",
    tail: species.longTail ? "long" : "medium",
    legs: "short",
    marks: [],
  };
}
