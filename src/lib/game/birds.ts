/**
 * Bird catalog. Each species is pure data — colors and a few shape flags — that
 * the BirdSprite renders into an original SVG, so we get a varied flock without
 * any external art. Rarity drives hatch odds. Shared by server (hatching) and
 * client (rendering).
 */

export type Rarity = "common" | "uncommon" | "rare" | "legendary" | "wild";

export interface BirdPalette {
  body: string;
  belly: string;
  wing: string;
  beak: string;
  cheek: string;
}

export interface BirdSpecies {
  key: string;
  name: string;
  rarity: Rarity;
  palette: BirdPalette;
  crest?: boolean; // a little head tuft
  longTail?: boolean;
  blurb: string;
}

export const BIRD_SPECIES: BirdSpecies[] = [
  { key: "sparrow", name: "Sparrow", rarity: "common", palette: { body: "#a98363", belly: "#efe2cf", wing: "#7c5e44", beak: "#5a4733", cheek: "#d8a07a" }, blurb: "Cheerful and always around." },
  { key: "robin", name: "Robin", rarity: "common", palette: { body: "#6e6258", belly: "#e8743b", wing: "#4f463f", beak: "#3a342e", cheek: "#f29b6f" }, blurb: "First sign of a new morning." },
  { key: "chickadee", name: "Chickadee", rarity: "common", palette: { body: "#cfd6da", belly: "#f6f3ee", wing: "#3a3f44", beak: "#2c2f33", cheek: "#ffffff" }, blurb: "Tiny, curious, fearless." },
  { key: "goldfinch", name: "Goldfinch", rarity: "uncommon", palette: { body: "#f2c43d", belly: "#fbe9a6", wing: "#2e2a22", beak: "#caa12f", cheek: "#fff3c4" }, blurb: "A spark of sunshine." },
  { key: "bluebird", name: "Bluebird", rarity: "uncommon", palette: { body: "#5b8fd6", belly: "#f1d7a8", wing: "#34568f", beak: "#3a3a3a", cheek: "#cfe0f6" }, blurb: "Carries good moods on its wings." },
  { key: "cardinal", name: "Cardinal", rarity: "uncommon", palette: { body: "#d23b34", belly: "#e87d76", wing: "#9c2722", beak: "#f0a93f", cheek: "#2c2c2c" }, crest: true, blurb: "Bold and impossible to miss." },
  { key: "bluejay", name: "Blue Jay", rarity: "uncommon", palette: { body: "#4a78c9", belly: "#eef3fb", wing: "#22407a", beak: "#2b2b2b", cheek: "#dbe7f8" }, crest: true, blurb: "Clever, loud, and proud." },
  { key: "kingfisher", name: "Kingfisher", rarity: "rare", palette: { body: "#2bb6c4", belly: "#f3a44e", wing: "#147884", beak: "#2c2c2c", cheek: "#bff0f4" }, crest: true, blurb: "A flash of color by the water." },
  { key: "hummingbird", name: "Hummingbird", rarity: "rare", palette: { body: "#34b27b", belly: "#d8f0e2", wing: "#1f7a54", beak: "#3a3a3a", cheek: "#ff7aa2" }, longTail: true, blurb: "Never stops, never quits." },
  { key: "puffin", name: "Puffin", rarity: "rare", palette: { body: "#2b2b2b", belly: "#ffffff", wing: "#1c1c1c", beak: "#f0683a", cheek: "#ffffff" }, blurb: "Dapper little sea clown." },
  { key: "toucan", name: "Toucan", rarity: "rare", palette: { body: "#2c2c2c", belly: "#f6e27a", wing: "#1c1c1c", beak: "#f0883a", cheek: "#7ec8e3" }, blurb: "All about that beak." },
  { key: "owl", name: "Owl", rarity: "rare", palette: { body: "#8a6f55", belly: "#e7d6bd", wing: "#5f4c3a", beak: "#caa12f", cheek: "#f0e3cd" }, crest: true, blurb: "Quiet wisdom, night and day." },
  { key: "peacock", name: "Peacock", rarity: "legendary", palette: { body: "#1f7a8c", belly: "#2a9d8f", wing: "#0d4f5c", beak: "#2c2c2c", cheek: "#8fe3d6" }, crest: true, longTail: true, blurb: "Pure, unapologetic splendor." },
  { key: "phoenix", name: "Phoenix", rarity: "legendary", palette: { body: "#f0683a", belly: "#f2c43d", wing: "#c23b1f", beak: "#caa12f", cheek: "#ffd98a" }, crest: true, longTail: true, blurb: "Rises again every single day." },
];

export const SPECIES_BY_KEY: Record<string, BirdSpecies> = Object.fromEntries(BIRD_SPECIES.map((b) => [b.key, b]));

export const RARITY_META: Record<Rarity, { label: string; color: string; weight: number }> = {
  common: { label: "Common", color: "#8a9099", weight: 100 },
  uncommon: { label: "Uncommon", color: "#3f9d5a", weight: 38 },
  rare: { label: "Rare", color: "#3b7fd2", weight: 11 },
  legendary: { label: "Legendary", color: "#b5862f", weight: 2 },
  // Photographed real birds — not part of the hatch pool.
  wild: { label: "Wild · yours", color: "#2a9d8f", weight: 0 },
};

/** The custom fields a photo bird carries on its row. */
export interface OwnedBirdBase {
  species_key: string | null;
  source: "hatched" | "photo";
  custom_name: string | null;
  custom_blurb: string | null;
  custom_palette: BirdPalette | null;
  custom_crest: boolean | null;
  custom_long_tail: boolean | null;
}

/** Resolve any owned bird (hatched or photographed) to a renderable species. */
export function resolveSpecies(b: OwnedBirdBase): BirdSpecies {
  if (b.source === "photo" && b.custom_palette) {
    return {
      key: `wild-${b.species_key ?? "x"}`,
      name: b.custom_name || "Wild bird",
      rarity: "wild",
      palette: b.custom_palette,
      crest: b.custom_crest ?? false,
      longTail: b.custom_long_tail ?? false,
      blurb: b.custom_blurb || "A real bird you spotted.",
    };
  }
  return (b.species_key ? SPECIES_BY_KEY[b.species_key] : undefined) ?? BIRD_SPECIES[0];
}

/** Weighted random species for a hatched egg. */
export function rollSpecies(rng: () => number = Math.random): BirdSpecies {
  const pool = BIRD_SPECIES;
  const total = pool.reduce((s, b) => s + RARITY_META[b.rarity].weight, 0);
  let r = rng() * total;
  for (const b of pool) {
    r -= RARITY_META[b.rarity].weight;
    if (r <= 0) return b;
  }
  return pool[0];
}

/** XP thresholds → level (gentle curve). */
export function birdLevel(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(xp / 40)) + 1);
}
export function xpForLevel(level: number): number {
  return Math.pow(level - 1, 2) * 40;
}
