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

/**
 * Body archetype drives the silhouette so species actually look different — an
 * owl is round-headed, a flamingo is long-legged, a penguin stands upright, a
 * toucan has an oversized bill, etc. Each maps to shape params in the sprite.
 */
export type BirdArchetype =
  | "songbird"
  | "plump"
  | "corvid"
  | "owl"
  | "raptor"
  | "parrot"
  | "bigbeak"
  | "waterbird"
  | "flamingo"
  | "swan"
  | "penguin"
  | "hummingbird"
  | "longtail"
  | "woodpecker";

export interface BirdSpecies {
  key: string;
  name: string;
  rarity: Rarity;
  palette: BirdPalette;
  archetype?: BirdArchetype;
  crest?: boolean; // a little head tuft
  longTail?: boolean;
  blurb: string;
}

/** Archetype per species key (kept separate so the catalog stays terse). */
export const ARCHETYPE_BY_KEY: Record<string, BirdArchetype> = {
  // common
  sparrow: "songbird", robin: "songbird", chickadee: "songbird", house_finch: "songbird", wren: "songbird",
  dove: "plump", pigeon: "plump", starling: "songbird", junco: "songbird", titmouse: "songbird",
  nuthatch: "songbird", warbler: "songbird", lark: "songbird", crow: "corvid", swift: "songbird",
  phoebe: "songbird", bushtit: "songbird", sandpiper: "songbird", blackbird: "songbird", redpoll: "songbird",
  // uncommon
  goldfinch: "songbird", bluebird: "songbird", cardinal: "songbird", bluejay: "songbird", oriole: "songbird",
  tanager: "songbird", waxwing: "songbird", grosbeak: "songbird", bunting: "songbird", canary: "songbird",
  budgie: "parrot", lovebird: "parrot", cockatiel: "parrot", magpie: "longtail", pheasant: "longtail",
  penguin: "penguin", woodpecker: "woodpecker", kestrel: "raptor",
  // rare
  kingfisher: "bigbeak", hummingbird: "hummingbird", puffin: "penguin", toucan: "bigbeak", owl: "owl",
  barn_owl: "owl", parrot: "parrot", cockatoo: "parrot", lorikeet: "parrot", flamingo: "flamingo",
  heron: "waterbird", swan: "swan", hoopoe: "songbird", kookaburra: "bigbeak", bee_eater: "songbird",
  hawk: "raptor", falcon: "raptor",
  // legendary
  peacock: "longtail", phoenix: "longtail", macaw: "parrot", quetzal: "longtail", bird_of_paradise: "longtail",
  eagle: "raptor",
};

export function archetypeFor(species: { key: string; archetype?: BirdArchetype }): BirdArchetype {
  return species.archetype ?? ARCHETYPE_BY_KEY[species.key] ?? "songbird";
}

export const BIRD_SPECIES: BirdSpecies[] = [
  // ── Common ────────────────────────────────────────────────────────────────
  { key: "sparrow", name: "Sparrow", rarity: "common", palette: { body: "#a98363", belly: "#efe2cf", wing: "#7c5e44", beak: "#5a4733", cheek: "#d8a07a" }, blurb: "Cheerful and always around." },
  { key: "robin", name: "Robin", rarity: "common", palette: { body: "#6e6258", belly: "#e8743b", wing: "#4f463f", beak: "#3a342e", cheek: "#f29b6f" }, blurb: "First sign of a new morning." },
  { key: "chickadee", name: "Chickadee", rarity: "common", palette: { body: "#cfd6da", belly: "#f6f3ee", wing: "#3a3f44", beak: "#2c2f33", cheek: "#ffffff" }, blurb: "Tiny, curious, fearless." },
  { key: "house_finch", name: "House Finch", rarity: "common", palette: { body: "#9b6f63", belly: "#efe3d6", wing: "#6f4f44", beak: "#5a4a3a", cheek: "#d76a5a" }, blurb: "A rosy little regular." },
  { key: "wren", name: "Wren", rarity: "common", palette: { body: "#9c7a55", belly: "#e8dcc6", wing: "#6e5238", beak: "#4a3c2c", cheek: "#c9a983" }, longTail: true, blurb: "Tiny body, enormous song." },
  { key: "dove", name: "Mourning Dove", rarity: "common", palette: { body: "#b7a896", belly: "#efe7da", wing: "#8a7a66", beak: "#3a342e", cheek: "#d6c2a8" }, blurb: "Soft, gentle, and calm." },
  { key: "pigeon", name: "Pigeon", rarity: "common", palette: { body: "#8c95a3", belly: "#aeb6c2", wing: "#5e6573", beak: "#3a3a3a", cheek: "#7e95c4" }, blurb: "The unbothered city dweller." },
  { key: "starling", name: "Starling", rarity: "common", palette: { body: "#3a3550", belly: "#4a4566", wing: "#262238", beak: "#e8b04f", cheek: "#6f6a8c" }, blurb: "Iridescent in the right light." },
  { key: "junco", name: "Junco", rarity: "common", palette: { body: "#5a5560", belly: "#efe9e2", wing: "#3f3b45", beak: "#f0d3a8", cheek: "#c2bdc7" }, blurb: "A snowbird, dapper in grey." },
  { key: "titmouse", name: "Tufted Titmouse", rarity: "common", palette: { body: "#a9b0bd", belly: "#f2efe9", wing: "#7a8290", beak: "#2c2c2c", cheek: "#e0a07a" }, crest: true, blurb: "Big eyes, bigger attitude." },
  { key: "nuthatch", name: "Nuthatch", rarity: "common", palette: { body: "#7d97b8", belly: "#f2ece2", wing: "#4f6685", beak: "#3a3a3a", cheek: "#d8e2ee" }, blurb: "Walks down trees headfirst." },
  { key: "warbler", name: "Yellow Warbler", rarity: "common", palette: { body: "#e8d24f", belly: "#f8eeb0", wing: "#bda033", beak: "#3a3a3a", cheek: "#e8a36a" }, blurb: "A drop of springtime." },
  { key: "lark", name: "Lark", rarity: "common", palette: { body: "#b69a72", belly: "#efe6d2", wing: "#8a6f4f", beak: "#5a4a3a", cheek: "#d8c29c" }, crest: true, blurb: "Sings the sun awake." },
  { key: "crow", name: "Crow", rarity: "common", palette: { body: "#2a2a30", belly: "#3a3a42", wing: "#161618", beak: "#161618", cheek: "#4a4a55" }, blurb: "Smarter than it lets on." },
  { key: "swift", name: "Swift", rarity: "common", palette: { body: "#4a4640", belly: "#cdc6bb", wing: "#2f2c28", beak: "#2c2c2c", cheek: "#8a857c" }, blurb: "Practically lives in the air." },
  { key: "phoebe", name: "Phoebe", rarity: "common", palette: { body: "#7a756e", belly: "#f0ece4", wing: "#54504a", beak: "#2c2c2c", cheek: "#cfc8bd" }, blurb: "Wags its tail hello." },
  { key: "bushtit", name: "Bushtit", rarity: "common", palette: { body: "#9a8f82", belly: "#e6ded2", wing: "#6e6458", beak: "#3a3a3a", cheek: "#c2b6a6" }, longTail: true, blurb: "Travels in cheerful gangs." },
  { key: "sandpiper", name: "Sandpiper", rarity: "common", palette: { body: "#b7a07e", belly: "#f2ece0", wing: "#8a7355", beak: "#3a342e", cheek: "#d8c6a8" }, blurb: "Dances with the tide." },
  { key: "blackbird", name: "Blackbird", rarity: "common", palette: { body: "#26262a", belly: "#34343a", wing: "#161618", beak: "#e8a33a", cheek: "#4a4a52" }, blurb: "A velvet voice at dawn." },
  { key: "redpoll", name: "Redpoll", rarity: "common", palette: { body: "#a98a72", belly: "#efe5d6", wing: "#7a5f48", beak: "#cdb89a", cheek: "#d24a3a" }, blurb: "A little cap of crimson." },

  // ── Uncommon ──────────────────────────────────────────────────────────────
  { key: "goldfinch", name: "Goldfinch", rarity: "uncommon", palette: { body: "#f2c43d", belly: "#fbe9a6", wing: "#2e2a22", beak: "#caa12f", cheek: "#fff3c4" }, blurb: "A spark of sunshine." },
  { key: "bluebird", name: "Bluebird", rarity: "uncommon", palette: { body: "#5b8fd6", belly: "#f1d7a8", wing: "#34568f", beak: "#3a3a3a", cheek: "#cfe0f6" }, blurb: "Carries good moods on its wings." },
  { key: "cardinal", name: "Cardinal", rarity: "uncommon", palette: { body: "#d23b34", belly: "#e87d76", wing: "#9c2722", beak: "#f0a93f", cheek: "#2c2c2c" }, crest: true, blurb: "Bold and impossible to miss." },
  { key: "bluejay", name: "Blue Jay", rarity: "uncommon", palette: { body: "#4a78c9", belly: "#eef3fb", wing: "#22407a", beak: "#2b2b2b", cheek: "#dbe7f8" }, crest: true, blurb: "Clever, loud, and proud." },
  { key: "oriole", name: "Oriole", rarity: "uncommon", palette: { body: "#f0852f", belly: "#f7b85f", wing: "#2c2620", beak: "#5a5048", cheek: "#ffce8a" }, blurb: "A flame in the treetops." },
  { key: "tanager", name: "Scarlet Tanager", rarity: "uncommon", palette: { body: "#e23b2f", belly: "#f06a5a", wing: "#1c1c1c", beak: "#bdb6a8", cheek: "#ff8f7a" }, blurb: "Red so bright it hums." },
  { key: "waxwing", name: "Cedar Waxwing", rarity: "uncommon", palette: { body: "#bfa17a", belly: "#efe2c8", wing: "#6f5c46", beak: "#2c2c2c", cheek: "#e8c89a" }, crest: true, blurb: "Wears a tiny bandit mask." },
  { key: "grosbeak", name: "Rose Grosbeak", rarity: "uncommon", palette: { body: "#2c2c30", belly: "#f2efe8", wing: "#161618", beak: "#e6ddc8", cheek: "#e0506a" }, blurb: "A heart of rose on its chest." },
  { key: "bunting", name: "Indigo Bunting", rarity: "uncommon", palette: { body: "#3f57c4", belly: "#5a6fd0", wing: "#27306e", beak: "#3a3a3a", cheek: "#8f9ee8" }, blurb: "A scrap of fallen sky." },
  { key: "canary", name: "Canary", rarity: "uncommon", palette: { body: "#f5d23a", belly: "#fcefa0", wing: "#d4af2c", beak: "#e8a36a", cheek: "#fff6c8" }, blurb: "Sings the whole day through." },
  { key: "budgie", name: "Budgie", rarity: "uncommon", palette: { body: "#6cc24a", belly: "#bfe89a", wing: "#3f7a2c", beak: "#5a5048", cheek: "#e8d24f" }, blurb: "Small, chatty, full of beans." },
  { key: "lovebird", name: "Lovebird", rarity: "uncommon", palette: { body: "#5fb04a", belly: "#bfe39a", wing: "#3a7a30", beak: "#e2543a", cheek: "#f0a04a" }, blurb: "Happiest in a pair." },
  { key: "cockatiel", name: "Cockatiel", rarity: "uncommon", palette: { body: "#b7b0a4", belly: "#e8e2d6", wing: "#8a8276", beak: "#54504a", cheek: "#f0a04a" }, crest: true, blurb: "A whistler with a crest." },
  { key: "magpie", name: "Magpie", rarity: "uncommon", palette: { body: "#2a2a30", belly: "#f2efe8", wing: "#1c2940", beak: "#161618", cheek: "#4a5a7a" }, longTail: true, blurb: "Collector of shiny things." },
  { key: "pheasant", name: "Pheasant", rarity: "uncommon", palette: { body: "#9c5a2f", belly: "#c98a4f", wing: "#5a3620", beak: "#cdb6a0", cheek: "#d24a3a" }, longTail: true, blurb: "Struts like it owns the field." },
  { key: "penguin", name: "Penguin", rarity: "uncommon", palette: { body: "#2c2f3a", belly: "#f4f4f0", wing: "#1c1e26", beak: "#e8a33a", cheek: "#f0c24a" }, blurb: "Waddles with great dignity." },
  { key: "woodpecker", name: "Woodpecker", rarity: "uncommon", palette: { body: "#1f1f22", belly: "#f2ece0", wing: "#2c2c30", beak: "#bdb6a8", cheek: "#d23b34" }, crest: true, blurb: "Drums the morning in." },
  { key: "kestrel", name: "Kestrel", rarity: "uncommon", palette: { body: "#b06a3a", belly: "#e8cba8", wing: "#5a6f9c", beak: "#3a3a3a", cheek: "#e0b48a" }, blurb: "Hovers like a tiny hawk." },

  // ── Rare ──────────────────────────────────────────────────────────────────
  { key: "kingfisher", name: "Kingfisher", rarity: "rare", palette: { body: "#2bb6c4", belly: "#f3a44e", wing: "#147884", beak: "#2c2c2c", cheek: "#bff0f4" }, crest: true, blurb: "A flash of color by the water." },
  { key: "hummingbird", name: "Hummingbird", rarity: "rare", palette: { body: "#34b27b", belly: "#d8f0e2", wing: "#1f7a54", beak: "#3a3a3a", cheek: "#ff7aa2" }, longTail: true, blurb: "Never stops, never quits." },
  { key: "puffin", name: "Puffin", rarity: "rare", palette: { body: "#2b2b2b", belly: "#ffffff", wing: "#1c1c1c", beak: "#f0683a", cheek: "#ffffff" }, blurb: "Dapper little sea clown." },
  { key: "toucan", name: "Toucan", rarity: "rare", palette: { body: "#2c2c2c", belly: "#f6e27a", wing: "#1c1c1c", beak: "#f0883a", cheek: "#7ec8e3" }, blurb: "All about that beak." },
  { key: "owl", name: "Owl", rarity: "rare", palette: { body: "#8a6f55", belly: "#e7d6bd", wing: "#5f4c3a", beak: "#caa12f", cheek: "#f0e3cd" }, crest: true, blurb: "Quiet wisdom, night and day." },
  { key: "barn_owl", name: "Barn Owl", rarity: "rare", palette: { body: "#d8b87a", belly: "#f6efe2", wing: "#b0905c", beak: "#cdbf9a", cheek: "#fbf4e6" }, blurb: "A pale ghost of the dusk." },
  { key: "parrot", name: "Parrot", rarity: "rare", palette: { body: "#3aa84a", belly: "#7fd06a", wing: "#1f7a30", beak: "#e8c24a", cheek: "#e2543a" }, blurb: "Repeats your best ideas back." },
  { key: "cockatoo", name: "Cockatoo", rarity: "rare", palette: { body: "#f4f1ea", belly: "#fffdf8", wing: "#ddd6c8", beak: "#3a3a3a", cheek: "#f0d24a" }, crest: true, blurb: "Drama in a feather suit." },
  { key: "lorikeet", name: "Rainbow Lorikeet", rarity: "rare", palette: { body: "#2f7ad0", belly: "#e2543a", wing: "#2c8a3a", beak: "#f0683a", cheek: "#f0c24a" }, blurb: "Every color, all at once." },
  { key: "flamingo", name: "Flamingo", rarity: "rare", palette: { body: "#f08aa8", belly: "#f8b8cc", wing: "#e0607f", beak: "#2c2c2c", cheek: "#ffd0de" }, longTail: true, blurb: "Poised on a single leg." },
  { key: "heron", name: "Heron", rarity: "rare", palette: { body: "#9aa6b0", belly: "#e6ebef", wing: "#6e7a86", beak: "#e8c24a", cheek: "#c2cdd6" }, crest: true, blurb: "Patience with a long neck." },
  { key: "swan", name: "Swan", rarity: "rare", palette: { body: "#f6f4ef", belly: "#fffdf8", wing: "#e2dccf", beak: "#e2543a", cheek: "#f0e6d6" }, longTail: true, blurb: "Grace that glides." },
  { key: "hoopoe", name: "Hoopoe", rarity: "rare", palette: { body: "#d89a5a", belly: "#f0d6a8", wing: "#2c2c2c", beak: "#5a4a3a", cheek: "#f0c89a" }, crest: true, blurb: "Crowned and unforgettable." },
  { key: "kookaburra", name: "Kookaburra", rarity: "rare", palette: { body: "#bfa985", belly: "#efe6d2", wing: "#4f6f8a", beak: "#3a342e", cheek: "#d8c6a8" }, blurb: "Laughs at its own jokes." },
  { key: "bee_eater", name: "Bee-eater", rarity: "rare", palette: { body: "#3aa84a", belly: "#e8c24a", wing: "#2f7ad0", beak: "#2c2c2c", cheek: "#e2543a" }, longTail: true, blurb: "Catches lunch mid-air." },
  { key: "hawk", name: "Hawk", rarity: "rare", palette: { body: "#8a6f55", belly: "#e8dcc6", wing: "#5a4636", beak: "#e8c24a", cheek: "#c9a983" }, blurb: "Eyes that miss nothing." },
  { key: "falcon", name: "Falcon", rarity: "rare", palette: { body: "#5a6675", belly: "#e6ebef", wing: "#3a4350", beak: "#e8c24a", cheek: "#9aa6b0" }, blurb: "The fastest thing alive." },

  // ── Legendary ─────────────────────────────────────────────────────────────
  { key: "peacock", name: "Peacock", rarity: "legendary", palette: { body: "#1f7a8c", belly: "#2a9d8f", wing: "#0d4f5c", beak: "#2c2c2c", cheek: "#8fe3d6" }, crest: true, longTail: true, blurb: "Pure, unapologetic splendor." },
  { key: "phoenix", name: "Phoenix", rarity: "legendary", palette: { body: "#f0683a", belly: "#f2c43d", wing: "#c23b1f", beak: "#caa12f", cheek: "#ffd98a" }, crest: true, longTail: true, blurb: "Rises again every single day." },
  { key: "macaw", name: "Scarlet Macaw", rarity: "legendary", palette: { body: "#e23b2f", belly: "#f0683a", wing: "#2f7ad0", beak: "#f2efe8", cheek: "#f0c24a" }, longTail: true, blurb: "A living firework." },
  { key: "quetzal", name: "Quetzal", rarity: "legendary", palette: { body: "#1f9d7a", belly: "#e2543a", wing: "#147a5c", beak: "#e8c24a", cheek: "#8fe3c4" }, crest: true, longTail: true, blurb: "The jewel of the cloud forest." },
  { key: "bird_of_paradise", name: "Bird of Paradise", rarity: "legendary", palette: { body: "#1f1f22", belly: "#f0852f", wing: "#2c2c30", beak: "#cdbf9a", cheek: "#3aa84a" }, crest: true, longTail: true, blurb: "Dances like no one's watching." },
  { key: "eagle", name: "Golden Eagle", rarity: "legendary", palette: { body: "#6f4f33", belly: "#b08a5c", wing: "#4a3620", beak: "#e8c24a", cheek: "#d4af6a" }, crest: true, blurb: "Rules the open sky." },
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
