/**
 * Bird catalog — 60 species of Maine. Each bird is pure data: a palette plus an
 * `art` recipe (a silhouette template + an ordered list of real field marks)
 * that the bird-art engine renders into a unique SVG. No two share a body — a
 * chickadee, a cardinal, a puffin and a heron are built from different
 * templates and marks, not one shape recoloured. Rarity drives hatch odds.
 */

import type { BirdArt } from "@/lib/game/bird-art";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "wild";

export interface BirdPalette {
  body: string;
  belly: string;
  wing: string;
  beak: string;
  cheek: string; // accent — also the crest colour for crested species
}

/** Voice family, used only to pick a synthesized call. */
export type BirdArchetype =
  | "songbird"
  | "cardinal"
  | "jay"
  | "corvid"
  | "woodpecker"
  | "raptor"
  | "owl"
  | "hummingbird"
  | "dove"
  | "duck"
  | "goose"
  | "loon"
  | "gull"
  | "seabird"
  | "gamebird"
  | "shorebird"
  | "wader"
  | "swallow";

export interface BirdSpecies {
  key: string;
  name: string;
  rarity: Rarity;
  palette: BirdPalette;
  archetype?: BirdArchetype;
  art?: BirdArt;
  crest?: boolean; // legacy flag, used by photo/wild birds only
  longTail?: boolean; // legacy flag, used by photo/wild birds only
  blurb: string;
}

export function archetypeFor(species: { archetype?: BirdArchetype }): BirdArchetype {
  return species.archetype ?? "songbird";
}

// Shorthand colours reused across many birds.
const BLACK = "#23211f";
const WHITE = "#f6f3ec";
const CREAM = "#efe6d2";

export const BIRD_SPECIES: BirdSpecies[] = [
  // 1
  {
    key: "black_capped_chickadee",
    name: "Black-capped Chickadee",
    rarity: "common",
    archetype: "songbird",
    palette: {
      body: "#b7bec4",
      belly: "#f3efe6",
      wing: "#6f777c",
      beak: "#2a2a2a",
      cheek: "#ffffff",
    },
    art: {
      template: "perch",
      bill: "cone",
      tail: "medium",
      legs: "short",
      marks: [
        { m: "cheek", color: "#ffffff" },
        { m: "cap", color: BLACK, extent: "full" },
        { m: "bib", color: BLACK },
      ],
    },
    blurb: "Tiny, curious, fearless.",
  },
  // 2
  {
    key: "american_robin",
    name: "American Robin",
    rarity: "common",
    archetype: "songbird",
    palette: {
      body: "#6e6256",
      belly: "#c0532b",
      wing: "#54493f",
      beak: "#e8a93a",
      cheek: "#6e6256",
    },
    art: {
      template: "upright",
      bill: "stout",
      tail: "medium",
      legs: "medium",
      marks: [
        { m: "eyering", color: CREAM },
        { m: "throat", color: "#3a342e" },
      ],
    },
    blurb: "First sign of a new morning.",
  },
  // 3
  {
    key: "northern_cardinal",
    name: "Northern Cardinal",
    rarity: "common",
    archetype: "cardinal",
    palette: {
      body: "#c0392b",
      belly: "#d5564a",
      wing: "#9c2a22",
      beak: "#e8883a",
      cheek: "#c0392b",
    },
    art: {
      template: "perch",
      bill: "cone",
      crest: "spike",
      tail: "long",
      legs: "short",
      marks: [{ m: "mask", color: "#1f1c1a" }],
    },
    blurb: "Bold and impossible to miss.",
  },
  // 4
  {
    key: "blue_jay",
    name: "Blue Jay",
    rarity: "common",
    archetype: "jay",
    palette: {
      body: "#5b86c9",
      belly: "#eef2f7",
      wing: "#2f4f8f",
      beak: "#2b2b2b",
      cheek: "#5b86c9",
    },
    art: {
      template: "perch",
      bill: "stout",
      crest: "spike",
      tail: "long",
      legs: "short",
      marks: [
        { m: "cheek", color: "#eef2f7" },
        { m: "collar", color: "#22324f" },
        { m: "wingbars", color: WHITE, count: 2 },
      ],
    },
    blurb: "Clever, loud, and proud.",
  },
  // 5
  {
    key: "american_goldfinch",
    name: "American Goldfinch",
    rarity: "common",
    archetype: "songbird",
    palette: {
      body: "#ecd233",
      belly: "#f5e88f",
      wing: "#1f1d18",
      beak: "#d99a45",
      cheek: "#ecd233",
    },
    art: {
      template: "perch",
      bill: "cone",
      tail: "short",
      legs: "short",
      marks: [
        { m: "forehead", color: "#1f1d18" },
        { m: "wingbars", color: WHITE, count: 2 },
      ],
    },
    blurb: "A spark of sunshine.",
  },
  // 6
  {
    key: "downy_woodpecker",
    name: "Downy Woodpecker",
    rarity: "common",
    archetype: "woodpecker",
    palette: {
      body: "#2a2a2a",
      belly: "#f6f1e8",
      wing: "#1f1f1f",
      beak: "#555555",
      cheek: "#ffffff",
    },
    art: {
      template: "cling",
      bill: "chisel",
      tail: "short",
      marks: [
        { m: "cheek", color: WHITE },
        { m: "eyeline", color: "#1f1f1f" },
        { m: "nape", color: "#cc3b30" },
        { m: "ladderback", color: WHITE },
      ],
    },
    blurb: "The little drummer of the yard.",
  },
  // 7
  {
    key: "hairy_woodpecker",
    name: "Hairy Woodpecker",
    rarity: "uncommon",
    archetype: "woodpecker",
    palette: {
      body: "#262626",
      belly: "#f6f1e8",
      wing: "#1c1c1c",
      beak: "#6a6a6a",
      cheek: "#ffffff",
    },
    art: {
      template: "cling",
      bill: "chisel",
      tail: "medium",
      marks: [
        { m: "cheek", color: WHITE },
        { m: "eyeline", color: "#1c1c1c" },
        { m: "nape", color: "#cc3b30" },
        { m: "ladderback", color: WHITE },
      ],
    },
    blurb: "Downy's bigger, bolder cousin.",
  },
  // 8
  {
    key: "pileated_woodpecker",
    name: "Pileated Woodpecker",
    rarity: "rare",
    archetype: "woodpecker",
    palette: {
      body: "#25241f",
      belly: "#2a2a26",
      wing: "#1b1a17",
      beak: "#3a3a3a",
      cheek: "#cc2a22",
    },
    art: {
      template: "cling",
      bill: "chisel",
      crest: "spike",
      tail: "medium",
      marks: [
        { m: "facelines", color: WHITE },
        { m: "throat", color: WHITE },
      ],
    },
    blurb: "A crow-sized blaze of red.",
  },
  // 9
  {
    key: "red_bellied_woodpecker",
    name: "Red-bellied Woodpecker",
    rarity: "uncommon",
    archetype: "woodpecker",
    palette: {
      body: "#cbc5b6",
      belly: "#ddd6c6",
      wing: "#cbc5b6",
      beak: "#444444",
      cheek: "#cc3b30",
    },
    art: {
      template: "cling",
      bill: "chisel",
      tail: "short",
      marks: [
        { m: "cap", color: "#cc3b30", extent: "full" },
        { m: "barback", color: "#2a2a2a" },
        { m: "breastWash", color: "#d9a18a" },
      ],
    },
    blurb: "Zebra-backed, ember-capped.",
  },
  // 10
  {
    key: "northern_flicker",
    name: "Northern Flicker",
    rarity: "uncommon",
    archetype: "woodpecker",
    palette: {
      body: "#b79a72",
      belly: "#d8c29c",
      wing: "#8a6f4f",
      beak: "#4a3c2c",
      cheek: "#b79a72",
    },
    art: {
      template: "perch",
      bill: "decurved",
      tail: "medium",
      legs: "medium",
      marks: [
        { m: "barback", color: "#6e573c" },
        { m: "bib", color: "#26241f" },
        { m: "spots", color: "#3a322a" },
        { m: "nape", color: "#cc3b30" },
      ],
    },
    blurb: "A woodpecker that loves the ground.",
  },
  // 11
  {
    key: "white_breasted_nuthatch",
    name: "White-breasted Nuthatch",
    rarity: "common",
    archetype: "songbird",
    palette: {
      body: "#8a98ac",
      belly: "#f4f1ea",
      wing: "#4f6079",
      beak: "#3a3a3a",
      cheek: "#ffffff",
    },
    art: {
      template: "cling",
      bill: "thin",
      tail: "short",
      marks: [
        { m: "cheek", color: "#ffffff" },
        { m: "cap", color: "#23252b", extent: "full" },
      ],
    },
    blurb: "Walks down trees headfirst.",
  },
  // 12
  {
    key: "red_breasted_nuthatch",
    name: "Red-breasted Nuthatch",
    rarity: "uncommon",
    archetype: "songbird",
    palette: {
      body: "#7d8ea6",
      belly: "#d98a5a",
      wing: "#4f6079",
      beak: "#3a3a3a",
      cheek: "#ffffff",
    },
    art: {
      template: "cling",
      bill: "thin",
      tail: "short",
      marks: [
        { m: "cheek", color: "#ffffff" },
        { m: "cap", color: "#23252b", extent: "full" },
        { m: "eyebrow", color: "#ffffff" },
        { m: "eyeline", color: "#23252b" },
      ],
    },
    blurb: "A tiny tin-horn voice in the pines.",
  },
  // 13
  {
    key: "tufted_titmouse",
    name: "Tufted Titmouse",
    rarity: "common",
    archetype: "songbird",
    palette: {
      body: "#aab2bd",
      belly: "#f0ece4",
      wing: "#8a929e",
      beak: "#2c2c2c",
      cheek: "#aab2bd",
    },
    art: {
      template: "perch",
      bill: "cone",
      crest: "spike",
      tail: "medium",
      legs: "short",
      marks: [
        { m: "forehead", color: "#2a2a2a" },
        { m: "breastWash", color: "#e0a98a" },
      ],
    },
    blurb: "Big eyes, bigger attitude.",
  },
  // 14
  {
    key: "brown_creeper",
    name: "Brown Creeper",
    rarity: "uncommon",
    archetype: "songbird",
    palette: {
      body: "#8a6f4f",
      belly: "#f0ece2",
      wing: "#6e5238",
      beak: "#5a4a3a",
      cheek: "#cabfa8",
    },
    art: {
      template: "cling",
      bill: "decurved",
      tail: "short",
      marks: [
        { m: "eyebrow", color: "#e8dcc6" },
        { m: "spots", color: "#d8c8a8" },
      ],
    },
    blurb: "Tree bark come to life.",
  },
  // 15
  {
    key: "winter_wren",
    name: "Winter Wren",
    rarity: "uncommon",
    archetype: "songbird",
    palette: {
      body: "#6e4f33",
      belly: "#9c7a55",
      wing: "#4f3a26",
      beak: "#3a2c20",
      cheek: "#c9a983",
    },
    art: {
      template: "perch",
      bill: "thin",
      tail: "cock",
      legs: "medium",
      marks: [
        { m: "eyebrow", color: "#d8c29c" },
        { m: "barback", color: "#3a2c20" },
      ],
    },
    blurb: "A thimble of bird, a fountain of song.",
  },
  // 16
  {
    key: "house_wren",
    name: "House Wren",
    rarity: "common",
    archetype: "songbird",
    palette: {
      body: "#9c7a55",
      belly: "#cabb9c",
      wing: "#6e5238",
      beak: "#4a3c2c",
      cheek: "#c9a983",
    },
    art: {
      template: "perch",
      bill: "thin",
      tail: "updown",
      legs: "medium",
      marks: [
        { m: "eyebrow", color: "#d8c8aa" },
        { m: "barback", color: "#5a4332" },
      ],
    },
    blurb: "Tiny body, enormous song.",
  },
  // 17
  {
    key: "eastern_bluebird",
    name: "Eastern Bluebird",
    rarity: "uncommon",
    archetype: "songbird",
    palette: {
      body: "#4f86c4",
      belly: "#c46a3a",
      wing: "#3a5f96",
      beak: "#2c2c2c",
      cheek: "#4f86c4",
    },
    art: {
      template: "perch",
      bill: "stout",
      tail: "medium",
      legs: "short",
      marks: [{ m: "undertail", color: "#f0ece2" }],
    },
    blurb: "Carries good moods on its wings.",
  },
  // 18
  {
    key: "cedar_waxwing",
    name: "Cedar Waxwing",
    rarity: "uncommon",
    archetype: "songbird",
    palette: {
      body: "#b89a72",
      belly: "#d8c6a0",
      wing: "#6f6052",
      beak: "#2c2c2c",
      cheek: "#b89a72",
    },
    art: {
      template: "perch",
      bill: "stout",
      crest: "sweep",
      tail: "short",
      legs: "short",
      marks: [
        { m: "mask", color: "#1f1c19" },
        { m: "tailtip", color: "#e6d24a" },
        { m: "wingPatch", color: "#c0392b" },
      ],
    },
    blurb: "Wears a tiny bandit mask.",
  },
  // 19
  {
    key: "gray_catbird",
    name: "Gray Catbird",
    rarity: "uncommon",
    archetype: "songbird",
    palette: {
      body: "#6a6a70",
      belly: "#76767c",
      wing: "#4f4f55",
      beak: "#2c2c2c",
      cheek: "#6a6a70",
    },
    art: {
      template: "upright",
      bill: "stout",
      tail: "long",
      legs: "medium",
      marks: [
        { m: "cap", color: "#222226", extent: "small" },
        { m: "undertail", color: "#8a4a3a" },
      ],
    },
    blurb: "Mews like a cat from the hedge.",
  },
  // 20
  {
    key: "brown_thrasher",
    name: "Brown Thrasher",
    rarity: "uncommon",
    archetype: "songbird",
    palette: {
      body: "#a85a30",
      belly: "#f0e6d2",
      wing: "#8a4a28",
      beak: "#5a4636",
      cheek: "#a85a30",
    },
    art: {
      template: "upright",
      bill: "decurved",
      tail: "long",
      legs: "medium",
      marks: [
        { m: "streaks", color: "#9c4f2a" },
        { m: "wingbars", color: WHITE, count: 2 },
      ],
    },
    blurb: "A thousand songs, each sung twice.",
  },
  // 21
  {
    key: "song_sparrow",
    name: "Song Sparrow",
    rarity: "common",
    archetype: "songbird",
    palette: {
      body: "#9c7a58",
      belly: "#efe6d6",
      wing: "#6e5238",
      beak: "#5a4733",
      cheek: "#b89a72",
    },
    art: {
      template: "perch",
      bill: "cone",
      tail: "medium",
      legs: "short",
      marks: [
        { m: "crownStripe", color: "#8a5a38" },
        { m: "streaks", color: "#7a5a3a" },
        { m: "breastSpot", color: "#3a2a1c" },
      ],
    },
    blurb: "The yard's tireless singer.",
  },
  // 22
  {
    key: "white_throated_sparrow",
    name: "White-throated Sparrow",
    rarity: "uncommon",
    archetype: "songbird",
    palette: {
      body: "#8a7155",
      belly: "#d8cdba",
      wing: "#6e5238",
      beak: "#4a3c2c",
      cheek: "#8a7155",
    },
    art: {
      template: "perch",
      bill: "cone",
      tail: "medium",
      legs: "short",
      marks: [
        { m: "cap", color: "#2a2620", extent: "full" },
        { m: "crownStripe", color: WHITE },
        { m: "forehead", color: "#e8c24a" },
        { m: "throat", color: "#ffffff" },
      ],
    },
    blurb: "Whistles 'Old Sam Peabody'.",
  },
  // 23
  {
    key: "chipping_sparrow",
    name: "Chipping Sparrow",
    rarity: "common",
    archetype: "songbird",
    palette: {
      body: "#9a8466",
      belly: "#ddd6c6",
      wing: "#7a5f44",
      beak: "#2c2c2c",
      cheek: "#c2b6a2",
    },
    art: {
      template: "perch",
      bill: "cone",
      tail: "medium",
      legs: "short",
      marks: [
        { m: "cap", color: "#a8542c", extent: "full" },
        { m: "eyebrow", color: "#eceae2" },
        { m: "eyeline", color: "#26241f" },
      ],
    },
    blurb: "A neat little rusty cap.",
  },
  // 24
  {
    key: "dark_eyed_junco",
    name: "Dark-eyed Junco",
    rarity: "common",
    archetype: "songbird",
    palette: {
      body: "#5a5560",
      belly: "#efe9e2",
      wing: "#4a454f",
      beak: "#e8cdb0",
      cheek: "#5a5560",
    },
    art: {
      template: "perch",
      bill: "cone",
      tail: "medium",
      legs: "short",
      marks: [{ m: "undertail", color: "#ffffff" }],
    },
    blurb: "The dapper grey snowbird.",
  },
  // 25
  {
    key: "red_winged_blackbird",
    name: "Red-winged Blackbird",
    rarity: "uncommon",
    archetype: "corvid",
    palette: {
      body: "#1c1c1f",
      belly: "#232326",
      wing: "#161618",
      beak: "#3a3a3a",
      cheek: "#1c1c1f",
    },
    art: {
      template: "perch",
      bill: "thin",
      tail: "medium",
      legs: "short",
      marks: [{ m: "epaulet", color: "#c0392b", edge: "#e8c24a" }],
    },
    blurb: "Conk-la-ree! from the cattails.",
  },
  // 26
  {
    key: "common_grackle",
    name: "Common Grackle",
    rarity: "uncommon",
    archetype: "corvid",
    palette: {
      body: "#3a3326",
      belly: "#3a3326",
      wing: "#241f30",
      beak: "#2a2a2a",
      cheek: "#4a4a55",
    },
    art: {
      template: "upright",
      bill: "stout",
      tail: "long",
      legs: "medium",
      marks: [{ m: "hood", color: "#3a2f55" }],
    },
    blurb: "Oil-slick sheen, golden eye.",
  },
  // 27
  {
    key: "baltimore_oriole",
    name: "Baltimore Oriole",
    rarity: "uncommon",
    archetype: "songbird",
    palette: {
      body: "#ef7f2e",
      belly: "#f59a4a",
      wing: "#1f1a16",
      beak: "#5a5048",
      cheek: "#ef7f2e",
    },
    art: {
      template: "perch",
      bill: "thin",
      tail: "medium",
      legs: "short",
      marks: [
        { m: "hood", color: "#1f1a16" },
        { m: "wingbars", color: WHITE, count: 1 },
      ],
    },
    blurb: "A flame in the treetops.",
  },
  // 28
  {
    key: "scarlet_tanager",
    name: "Scarlet Tanager",
    rarity: "rare",
    archetype: "songbird",
    palette: {
      body: "#d8392a",
      belly: "#e85a48",
      wing: "#1a1a1a",
      beak: "#c9c2b0",
      cheek: "#d8392a",
    },
    art: { template: "perch", bill: "stout", tail: "short", legs: "short", marks: [] },
    blurb: "Red so bright it hums.",
  },
  // 29
  {
    key: "rose_breasted_grosbeak",
    name: "Rose-breasted Grosbeak",
    rarity: "rare",
    archetype: "songbird",
    palette: {
      body: "#1f1c1a",
      belly: "#f4f1ea",
      wing: "#161412",
      beak: "#e6ddc8",
      cheek: "#1f1c1a",
    },
    art: {
      template: "perch",
      bill: "cone",
      tail: "medium",
      legs: "short",
      marks: [
        { m: "breastTriangle", color: "#cc3550" },
        { m: "wingbars", color: WHITE, count: 1 },
      ],
    },
    blurb: "Wears its heart on its chest.",
  },
  // 30
  {
    key: "indigo_bunting",
    name: "Indigo Bunting",
    rarity: "uncommon",
    archetype: "songbird",
    palette: {
      body: "#3f63c4",
      belly: "#5a72c8",
      wing: "#2a3f86",
      beak: "#3a3a3a",
      cheek: "#3f63c4",
    },
    art: { template: "perch", bill: "cone", tail: "short", legs: "short", marks: [] },
    blurb: "A scrap of fallen sky.",
  },
  // 31
  {
    key: "tree_swallow",
    name: "Tree Swallow",
    rarity: "uncommon",
    archetype: "swallow",
    palette: {
      body: "#2f7d8a",
      belly: "#f4f1ea",
      wing: "#235f6a",
      beak: "#2a2a2a",
      cheek: "#2f7d8a",
    },
    art: { template: "flit", bill: "thin", tail: "fork", marks: [] },
    blurb: "Steel-blue and sky-bound.",
  },
  // 32
  {
    key: "barn_swallow",
    name: "Barn Swallow",
    rarity: "uncommon",
    archetype: "swallow",
    palette: {
      body: "#2a3f86",
      belly: "#e8b98a",
      wing: "#1f2f66",
      beak: "#2a2a2a",
      cheek: "#a8442a",
    },
    art: {
      template: "flit",
      bill: "thin",
      tail: "fork",
      marks: [
        { m: "throat", color: "#a8442a" },
        { m: "forehead", color: "#a8442a" },
      ],
    },
    blurb: "Forked tail, endless loops.",
  },
  // 33
  {
    key: "ruby_throated_hummingbird",
    name: "Ruby-throated Hummingbird",
    rarity: "rare",
    archetype: "hummingbird",
    palette: {
      body: "#3a9d6a",
      belly: "#f0ece2",
      wing: "#2a7a52",
      beak: "#2a2a2a",
      cheek: "#cc3b50",
    },
    art: { template: "hover", bill: "thin", marks: [{ m: "throat", color: "#c0293f" }] },
    blurb: "Never stops, never quits.",
  },
  // 34
  {
    key: "mourning_dove",
    name: "Mourning Dove",
    rarity: "common",
    archetype: "dove",
    palette: {
      body: "#b3a48f",
      belly: "#e8dcc9",
      wing: "#8a7a64",
      beak: "#3a342e",
      cheek: "#d8b0a0",
    },
    art: {
      template: "perch",
      bill: "thin",
      tail: "point",
      legs: "short",
      marks: [{ m: "spots", color: "#3a342e" }],
    },
    blurb: "Soft, gentle, and calm.",
  },
  // 35
  {
    key: "wild_turkey",
    name: "Wild Turkey",
    rarity: "legendary",
    archetype: "gamebird",
    palette: {
      body: "#5a4630",
      belly: "#6e5238",
      wing: "#3a2c1d",
      beak: "#d8a05a",
      cheek: "#c0392b",
    },
    art: {
      template: "gamebird",
      bill: "stout",
      tail: "fan",
      legs: "long",
      marks: [
        { m: "scaly", color: "#7a6244" },
        { m: "hood", color: "#6a86a0" },
        { m: "throat", color: "#c0392b" },
      ],
    },
    blurb: "Struts like it owns the woods.",
  },
  // 36
  {
    key: "ruffed_grouse",
    name: "Ruffed Grouse",
    rarity: "rare",
    archetype: "gamebird",
    palette: {
      body: "#a8855c",
      belly: "#e0cba8",
      wing: "#7a5f3f",
      beak: "#4a3c2c",
      cheek: "#a8855c",
    },
    art: {
      template: "gamebird",
      bill: "stout",
      crest: "spike",
      tail: "fan",
      legs: "short",
      marks: [
        { m: "scaly", color: "#6e5238" },
        { m: "bib", color: "#2a2018" },
        { m: "tailband", color: "#3a2c1d" },
      ],
    },
    blurb: "Drums the forest with its wings.",
  },
  // 37
  {
    key: "spruce_grouse",
    name: "Spruce Grouse",
    rarity: "rare",
    archetype: "gamebird",
    palette: {
      body: "#4a4540",
      belly: "#5a5048",
      wing: "#3a352f",
      beak: "#2c2c2c",
      cheek: "#4a4540",
    },
    art: {
      template: "gamebird",
      bill: "stout",
      tail: "fan",
      legs: "short",
      marks: [
        { m: "bib", color: "#1f1c19" },
        { m: "spots", color: "#d8d2c6" },
        { m: "eyebrow", color: "#c0392b" },
      ],
    },
    blurb: "The quiet ghost of the boreal.",
  },
  // 38
  {
    key: "american_woodcock",
    name: "American Woodcock",
    rarity: "rare",
    archetype: "shorebird",
    palette: {
      body: "#a8855c",
      belly: "#c9a875",
      wing: "#6e5238",
      beak: "#6e5840",
      cheek: "#a8855c",
    },
    art: {
      template: "shorebird",
      bill: "long",
      legs: "short",
      marks: [
        { m: "scaly", color: "#5a4530" },
        { m: "crownStripe", color: "#3a2c1d" },
      ],
    },
    blurb: "A plump woodland wanderer.",
  },
  // 39
  {
    key: "killdeer",
    name: "Killdeer",
    rarity: "uncommon",
    archetype: "shorebird",
    palette: {
      body: "#8a6f50",
      belly: "#f4f1ea",
      wing: "#6e5238",
      beak: "#2c2c2c",
      cheek: "#f4f1ea",
    },
    art: {
      template: "shorebird",
      bill: "thin",
      legs: "long",
      marks: [
        { m: "forehead", color: "#f4f1ea" },
        { m: "mask", color: "#26241f" },
        { m: "breastBand", color: "#26241f", count: 2 },
      ],
    },
    blurb: "Cries its own name across the field.",
  },
  // 40
  {
    key: "piping_plover",
    name: "Piping Plover",
    rarity: "rare",
    archetype: "shorebird",
    palette: {
      body: "#cabfa6",
      belly: "#f6f3ec",
      wing: "#b0a488",
      beak: "#e8a33a",
      cheek: "#f6f3ec",
    },
    art: {
      template: "shorebird",
      bill: "stout",
      legs: "medium",
      marks: [
        { m: "forehead", color: "#2a2620" },
        { m: "breastBand", color: "#2a2620", count: 1 },
      ],
    },
    blurb: "A wisp of dry sand on legs.",
  },
  // 41
  {
    key: "great_blue_heron",
    name: "Great Blue Heron",
    rarity: "rare",
    archetype: "wader",
    palette: {
      body: "#8a98a6",
      belly: "#c2cdd6",
      wing: "#6e7a88",
      beak: "#e8c24a",
      cheek: "#8a98a6",
    },
    art: {
      template: "wader",
      bill: "dagger",
      legs: "long",
      marks: [
        { m: "crownStripe", color: "#1f1c19" },
        { m: "streaks", color: "#6e7a88" },
      ],
    },
    blurb: "Patience with a long neck.",
  },
  // 42
  {
    key: "green_heron",
    name: "Green Heron",
    rarity: "rare",
    archetype: "wader",
    palette: {
      body: "#3a4a3f",
      belly: "#8a4a3a",
      wing: "#2f3f36",
      beak: "#2c2c2c",
      cheek: "#8a4a3a",
    },
    art: {
      template: "wader",
      bill: "dagger",
      legs: "short",
      marks: [{ m: "cap", color: "#26302a", extent: "full" }],
    },
    blurb: "A crouched little fishing master.",
  },
  // 43
  {
    key: "belted_kingfisher",
    name: "Belted Kingfisher",
    rarity: "rare",
    archetype: "jay",
    palette: {
      body: "#5f7d96",
      belly: "#f4f1ea",
      wing: "#4a6378",
      beak: "#2c2c2c",
      cheek: "#5f7d96",
    },
    art: {
      template: "perch",
      bill: "dagger",
      crest: "shag",
      tail: "short",
      legs: "short",
      marks: [
        { m: "collar", color: "#ffffff" },
        { m: "breastBand", color: "#557390", count: 1 },
      ],
    },
    blurb: "A rattle and a flash of blue.",
  },
  // 44
  {
    key: "osprey",
    name: "Osprey",
    rarity: "legendary",
    archetype: "raptor",
    palette: {
      body: "#4a4036",
      belly: "#f4f1ea",
      wing: "#3a322a",
      beak: "#2c2c2c",
      cheek: "#f4f1ea",
    },
    art: {
      template: "raptor",
      bill: "hook",
      tail: "medium",
      marks: [
        { m: "hood", color: "#f4f1ea" },
        { m: "eyeline", color: "#3a322a" },
      ],
    },
    blurb: "The fish-hawk of the bay.",
  },
  // 45
  {
    key: "bald_eagle",
    name: "Bald Eagle",
    rarity: "legendary",
    archetype: "raptor",
    palette: {
      body: "#4a3528",
      belly: "#4a3528",
      wing: "#3a281d",
      beak: "#e8c24a",
      cheek: "#f4f1ea",
    },
    art: {
      template: "raptor",
      bill: "hook",
      tail: "medium",
      marks: [
        { m: "hood", color: WHITE },
        { m: "tailtip", color: WHITE },
      ],
    },
    blurb: "Rules the open sky.",
  },
  // 46
  {
    key: "red_tailed_hawk",
    name: "Red-tailed Hawk",
    rarity: "rare",
    archetype: "raptor",
    palette: {
      body: "#7a5f44",
      belly: "#efe6d2",
      wing: "#5a4533",
      beak: "#3a3a3a",
      cheek: "#efe6d2",
    },
    art: {
      template: "raptor",
      bill: "hook",
      tail: "medium",
      marks: [
        { m: "streaks", color: "#9c6f44" },
        { m: "tailband", color: "#b0542f" },
      ],
    },
    blurb: "A keen-eyed soul of the soar.",
  },
  // 47
  {
    key: "coopers_hawk",
    name: "Cooper's Hawk",
    rarity: "rare",
    archetype: "raptor",
    palette: {
      body: "#5a6675",
      belly: "#f0e6df",
      wing: "#3f4a58",
      beak: "#e8c24a",
      cheek: "#5a6675",
    },
    art: {
      template: "raptor",
      bill: "hook",
      tail: "long",
      marks: [
        { m: "cap", color: "#2a323d", extent: "full" },
        { m: "streaks", color: "#c0804f" },
        { m: "tailband", color: "#2a323d" },
      ],
    },
    blurb: "The yard's silent ambush.",
  },
  // 48
  {
    key: "barred_owl",
    name: "Barred Owl",
    rarity: "rare",
    archetype: "owl",
    palette: {
      body: "#8a7a68",
      belly: "#e7dcc9",
      wing: "#6e5f4c",
      beak: "#e8c24a",
      cheek: "#8a7a68",
    },
    art: {
      template: "owl",
      bill: "hook",
      marks: [
        { m: "breastBand", color: "#6e5238", count: 2 },
        { m: "streaks", color: "#6e5238" },
      ],
    },
    blurb: "Who cooks for you?",
  },
  // 49
  {
    key: "great_horned_owl",
    name: "Great Horned Owl",
    rarity: "legendary",
    archetype: "owl",
    palette: {
      body: "#6e5a44",
      belly: "#c9b08a",
      wing: "#4f4030",
      beak: "#2c2c2c",
      cheek: "#6e5a44",
    },
    art: {
      template: "owl",
      bill: "hook",
      crest: "horns",
      marks: [
        { m: "throat", color: "#f0ece2" },
        { m: "scaly", color: "#4f4030" },
      ],
    },
    blurb: "The tiger of the night woods.",
  },
  // 50
  {
    key: "common_loon",
    name: "Common Loon",
    rarity: "legendary",
    archetype: "loon",
    palette: {
      body: "#2a2a2e",
      belly: "#f4f1ea",
      wing: "#1f1f22",
      beak: "#2a2a2a",
      cheek: "#2a2a2e",
    },
    art: {
      template: "float",
      bill: "dagger",
      marks: [
        { m: "hood", color: "#23232a" },
        { m: "checker", color: "#eef0ea" },
        { m: "collar", color: "#eef0ea" },
      ],
    },
    blurb: "A wild call across still water.",
  },
  // 51
  {
    key: "canada_goose",
    name: "Canada Goose",
    rarity: "common",
    archetype: "goose",
    palette: {
      body: "#8a7a5f",
      belly: "#e0d6c2",
      wing: "#6e5f48",
      beak: "#1f1f1f",
      cheek: "#ffffff",
    },
    art: {
      template: "goose",
      bill: "stout",
      marks: [
        { m: "hood", color: "#1f1f1f" },
        { m: "cheek", color: "#ffffff" },
      ],
    },
    blurb: "Honks the seasons in and out.",
  },
  // 52
  {
    key: "mallard",
    name: "Mallard",
    rarity: "common",
    archetype: "duck",
    palette: {
      body: "#9a948a",
      belly: "#b3a89a",
      wing: "#6e6258",
      beak: "#e8c24a",
      cheek: "#2f7a52",
    },
    art: {
      template: "float",
      bill: "spatula",
      marks: [
        { m: "hood", color: "#2f7a52" },
        { m: "collar", color: "#ffffff" },
        { m: "breastWash", color: "#8a4f2f" },
      ],
    },
    blurb: "The duck everybody knows.",
  },
  // 53
  {
    key: "wood_duck",
    name: "Wood Duck",
    rarity: "uncommon",
    archetype: "duck",
    palette: {
      body: "#6a5a4a",
      belly: "#b89a6a",
      wing: "#2f5a4a",
      beak: "#d8542f",
      cheek: "#2a5a4a",
    },
    art: {
      template: "float",
      bill: "spatula",
      crest: "sweep",
      marks: [
        { m: "hood", color: "#2f4a44" },
        { m: "facelines", color: "#ffffff" },
        { m: "breastWash", color: "#7a3a2a" },
      ],
    },
    blurb: "The most ornate duck of all.",
  },
  // 54
  {
    key: "common_eider",
    name: "Common Eider",
    rarity: "rare",
    archetype: "duck",
    palette: {
      body: "#f4f1ea",
      belly: "#23232a",
      wing: "#d8d2c6",
      beak: "#c9b89a",
      cheek: "#8fc4a0",
    },
    art: {
      template: "float",
      bill: "spatula",
      marks: [
        { m: "cap", color: "#23232a", extent: "full" },
        { m: "nape", color: "#9ad0b0" },
      ],
    },
    blurb: "A burly duck of the cold sea.",
  },
  // 55
  {
    key: "atlantic_puffin",
    name: "Atlantic Puffin",
    rarity: "rare",
    archetype: "seabird",
    palette: {
      body: "#232326",
      belly: "#f6f3ec",
      wing: "#1a1a1c",
      beak: "#e8542f",
      cheek: "#e8e4da",
    },
    art: {
      template: "seabird",
      bill: "huge",
      tail: "short",
      legs: "short",
      marks: [
        { m: "cap", color: "#232326", extent: "full" },
        { m: "cheek", color: "#e8e4da" },
      ],
    },
    blurb: "The clown of the open sea.",
  },
  // 56
  {
    key: "black_guillemot",
    name: "Black Guillemot",
    rarity: "rare",
    archetype: "seabird",
    palette: {
      body: "#26262a",
      belly: "#2a2a2e",
      wing: "#1c1c1f",
      beak: "#2a2a2a",
      cheek: "#26262a",
    },
    art: {
      template: "seabird",
      bill: "dagger",
      tail: "short",
      legs: "short",
      marks: [{ m: "wingPatch", color: "#f6f3ec" }],
    },
    blurb: "Black velvet with white wing-spots.",
  },
  // 57
  {
    key: "herring_gull",
    name: "Herring Gull",
    rarity: "common",
    archetype: "gull",
    palette: {
      body: "#f4f1ea",
      belly: "#f6f3ec",
      wing: "#b9bcc2",
      beak: "#e8c24a",
      cheek: "#f4f1ea",
    },
    art: {
      template: "seabird",
      bill: "stout",
      tail: "short",
      legs: "medium",
      marks: [
        { m: "wingtips", color: "#26262a" },
        { m: "billspot", color: "#c0392b" },
      ],
    },
    blurb: "The voice of every harbor.",
  },
  // 58
  {
    key: "common_tern",
    name: "Common Tern",
    rarity: "uncommon",
    archetype: "gull",
    palette: {
      body: "#d6dade",
      belly: "#f6f3ec",
      wing: "#b9bcc2",
      beak: "#e8683a",
      cheek: "#d6dade",
    },
    art: {
      template: "flit",
      bill: "thin",
      tail: "fork",
      marks: [
        { m: "cap", color: "#23232a", extent: "full" },
        { m: "wingtips", color: "#5a5f66" },
      ],
    },
    blurb: "A white dart over the surf.",
  },
  // 59
  {
    key: "common_raven",
    name: "Common Raven",
    rarity: "uncommon",
    archetype: "corvid",
    palette: {
      body: "#1c1c20",
      belly: "#232328",
      wing: "#141416",
      beak: "#161618",
      cheek: "#2a2a30",
    },
    art: {
      template: "perch",
      bill: "stout",
      tail: "medium",
      legs: "short",
      marks: [{ m: "bib", color: "#26262c" }],
    },
    blurb: "Smarter than it lets on.",
  },
  // 60
  {
    key: "peregrine_falcon",
    name: "Peregrine Falcon",
    rarity: "legendary",
    archetype: "raptor",
    palette: {
      body: "#4a505a",
      belly: "#e7e2d6",
      wing: "#363b44",
      beak: "#e8c24a",
      cheek: "#4a505a",
    },
    art: {
      template: "raptor",
      bill: "hook",
      tail: "medium",
      marks: [
        { m: "cap", color: "#363b44", extent: "full" },
        { m: "malar", color: "#2a2e35" },
        { m: "streaks", color: "#7a7f88" },
      ],
    },
    blurb: "The fastest thing alive.",
  },
];

export const SPECIES_BY_KEY: Record<string, BirdSpecies> = Object.fromEntries(
  BIRD_SPECIES.map((b) => [b.key, b])
);

/** Old catalog keys → nearest new Maine species, so existing flocks still render. */
export const LEGACY_KEY_MAP: Record<string, string> = {
  sparrow: "song_sparrow",
  robin: "american_robin",
  chickadee: "black_capped_chickadee",
  house_finch: "american_goldfinch",
  wren: "house_wren",
  dove: "mourning_dove",
  pigeon: "mourning_dove",
  starling: "common_grackle",
  junco: "dark_eyed_junco",
  titmouse: "tufted_titmouse",
  nuthatch: "white_breasted_nuthatch",
  warbler: "american_goldfinch",
  lark: "song_sparrow",
  crow: "common_raven",
  swift: "tree_swallow",
  phoebe: "eastern_bluebird",
  bushtit: "black_capped_chickadee",
  sandpiper: "killdeer",
  blackbird: "red_winged_blackbird",
  redpoll: "american_goldfinch",
  goldfinch: "american_goldfinch",
  bluebird: "eastern_bluebird",
  cardinal: "northern_cardinal",
  bluejay: "blue_jay",
  oriole: "baltimore_oriole",
  tanager: "scarlet_tanager",
  waxwing: "cedar_waxwing",
  grosbeak: "rose_breasted_grosbeak",
  bunting: "indigo_bunting",
  canary: "american_goldfinch",
  budgie: "american_goldfinch",
  lovebird: "eastern_bluebird",
  cockatiel: "tufted_titmouse",
  magpie: "blue_jay",
  pheasant: "ruffed_grouse",
  penguin: "atlantic_puffin",
  woodpecker: "downy_woodpecker",
  kestrel: "coopers_hawk",
  kingfisher: "belted_kingfisher",
  hummingbird: "ruby_throated_hummingbird",
  puffin: "atlantic_puffin",
  toucan: "belted_kingfisher",
  owl: "barred_owl",
  barn_owl: "barred_owl",
  parrot: "baltimore_oriole",
  cockatoo: "cedar_waxwing",
  lorikeet: "wood_duck",
  flamingo: "great_blue_heron",
  heron: "great_blue_heron",
  swan: "canada_goose",
  hoopoe: "northern_flicker",
  kookaburra: "belted_kingfisher",
  bee_eater: "baltimore_oriole",
  hawk: "red_tailed_hawk",
  falcon: "peregrine_falcon",
  peacock: "wild_turkey",
  phoenix: "northern_cardinal",
  macaw: "wood_duck",
  quetzal: "ruby_throated_hummingbird",
  bird_of_paradise: "baltimore_oriole",
  eagle: "bald_eagle",
};

/**
 * Centralized rarity config: display label, accent colour, hatch `weight`
 * (relative odds), and `sellValue` in seeds. This is the single source of truth
 * for the bird economy — never hardcode sell values elsewhere; read them through
 * {@link sellValueFor} / {@link RARITY_META}. `epic` is defined for future birds
 * (weight 0 today, so it never hatches yet); `wild` is a photographed bird.
 */
export const RARITY_META: Record<
  Rarity,
  { label: string; color: string; weight: number; sellValue: number }
> = {
  common: { label: "Common", color: "#8a9099", weight: 100, sellValue: 10 },
  uncommon: { label: "Uncommon", color: "#3f9d5a", weight: 38, sellValue: 25 },
  rare: { label: "Rare", color: "#3b7fd2", weight: 11, sellValue: 75 },
  epic: { label: "Epic", color: "#8b5cf6", weight: 0, sellValue: 200 },
  legendary: { label: "Legendary", color: "#b5862f", weight: 2, sellValue: 500 },
  wild: { label: "Wild · yours", color: "#2a9d8f", weight: 0, sellValue: 50 },
};

/** Alias matching the product spec's naming. Prefer {@link RARITY_META}. */
export const BIRD_RARITY_CONFIG = RARITY_META;

/** Seeds earned by selling a bird of this rarity. */
export function sellValueFor(rarity: Rarity): number {
  return RARITY_META[rarity].sellValue;
}

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
  const key = b.species_key ? (LEGACY_KEY_MAP[b.species_key] ?? b.species_key) : undefined;
  return (key ? SPECIES_BY_KEY[key] : undefined) ?? BIRD_SPECIES[0];
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
