import data from "./birds.json";

/**
 * Canonical manifest for the 60 Daybreak / Nest birds. The art lives at
 * `/public/assets/birds/<id>.png` (one transparent 512px sprite per species,
 * easy to swap for professional art later). Keep `id` in sync with the game
 * catalog keys in `@/lib/game/birds`.
 */

export type RarityTier = "common" | "uncommon" | "rare" | "legendary";

export interface BirdManifest {
  id: string;
  commonName: string;
  scientificName: string;
  region: string;
  habitat: string[];
  rarityTier: RarityTier;
  asset: string;
  fieldMarks: string[];
}

export const BIRDS: BirdManifest[] = data as BirdManifest[];

export const BIRDS_BY_ID: Record<string, BirdManifest> = Object.fromEntries(BIRDS.map((b) => [b.id, b]));

/** Sprite asset path for a species id (falls back to the shared placeholder). */
export function birdAsset(id: string | null | undefined): string | null {
  return id && BIRDS_BY_ID[id] ? BIRDS_BY_ID[id].asset : null;
}
