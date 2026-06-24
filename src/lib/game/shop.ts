/**
 * Shop & feeding catalog. Food is bought with seeds and fed to birds for
 * happiness + XP. The catch: every species can only eat foods that match its
 * real-world diet (DIET_BY_SPECIES). `canEat` is the single source of truth,
 * used to grey out the wrong foods in the UI *and* to reject them server-side —
 * so you can't feed fish to a cardinal. Pure data; safe on client and server.
 */

export type DietTag = "seed" | "suet" | "insect" | "nectar" | "fruit" | "grain" | "fish" | "prey" | "aquatic" | "worm";

export interface FoodItem {
  key: string;
  name: string;
  emoji: string;
  tag: DietTag;
  cost: number; // seeds
  happiness: number; // +happiness on feed
  xp: number; // +xp to the fed bird
  blurb: string;
}

export const DIET_META: Record<DietTag, { label: string; emoji: string }> = {
  seed: { label: "Seeds", emoji: "🌻" },
  suet: { label: "Suet", emoji: "🧈" },
  insect: { label: "Insects", emoji: "🐛" },
  nectar: { label: "Nectar", emoji: "🌺" },
  fruit: { label: "Fruit", emoji: "🫐" },
  grain: { label: "Grain", emoji: "🌽" },
  fish: { label: "Fish", emoji: "🐟" },
  prey: { label: "Prey", emoji: "🐭" },
  aquatic: { label: "Pond greens", emoji: "🌿" },
  worm: { label: "Worms", emoji: "🪱" },
};

export const FOOD_ITEMS: FoodItem[] = [
  { key: "sunflower_seeds", name: "Sunflower Seeds", emoji: "🌻", tag: "seed", cost: 8, happiness: 8, xp: 6, blurb: "A feeder favorite for seed-eaters." },
  { key: "cracked_corn", name: "Cracked Corn", emoji: "🌽", tag: "grain", cost: 6, happiness: 6, xp: 5, blurb: "Cheap, cheerful grain for ground feeders." },
  { key: "suet_cake", name: "Suet Cake", emoji: "🧈", tag: "suet", cost: 12, happiness: 10, xp: 8, blurb: "High-energy fat — woodpeckers love it." },
  { key: "mealworms", name: "Mealworms", emoji: "🐛", tag: "insect", cost: 10, happiness: 9, xp: 7, blurb: "Wriggly protein for insect-eaters." },
  { key: "wild_berries", name: "Wild Berries", emoji: "🫐", tag: "fruit", cost: 10, happiness: 9, xp: 7, blurb: "Juicy berries for fruit lovers." },
  { key: "nectar", name: "Sweet Nectar", emoji: "🌺", tag: "nectar", cost: 14, happiness: 12, xp: 9, blurb: "Sugar water — strictly for hummingbirds & orioles." },
  { key: "pond_greens", name: "Pond Greens", emoji: "🌿", tag: "aquatic", cost: 7, happiness: 7, xp: 5, blurb: "Tender water plants for dabbling ducks & geese." },
  { key: "earthworms", name: "Earthworms", emoji: "🪱", tag: "worm", cost: 9, happiness: 8, xp: 6, blurb: "Plucked from the soil for ground foragers." },
  { key: "fresh_minnows", name: "Fresh Minnows", emoji: "🐟", tag: "fish", cost: 16, happiness: 13, xp: 10, blurb: "Little fish for herons, loons & seabirds." },
  { key: "field_mouse", name: "Field Mouse", emoji: "🐭", tag: "prey", cost: 22, happiness: 16, xp: 13, blurb: "A hearty meal — only hawks, owls & falcons hunt these." },
];

export const FOOD_BY_KEY: Record<string, FoodItem> = Object.fromEntries(FOOD_ITEMS.map((f) => [f.key, f]));

/** What each species actually eats. Order is roughly favourite-first. */
export const DIET_BY_SPECIES: Record<string, DietTag[]> = {
  black_capped_chickadee: ["seed", "suet", "insect"],
  american_robin: ["worm", "fruit", "insect"],
  northern_cardinal: ["seed", "fruit"],
  blue_jay: ["seed", "insect", "fruit"],
  american_goldfinch: ["seed"],
  downy_woodpecker: ["suet", "insect"],
  hairy_woodpecker: ["suet", "insect"],
  pileated_woodpecker: ["insect", "suet", "fruit"],
  red_bellied_woodpecker: ["suet", "insect", "fruit"],
  northern_flicker: ["insect", "worm"],
  white_breasted_nuthatch: ["seed", "suet", "insect"],
  red_breasted_nuthatch: ["seed", "suet", "insect"],
  tufted_titmouse: ["seed", "suet", "insect"],
  brown_creeper: ["insect", "suet"],
  winter_wren: ["insect"],
  house_wren: ["insect"],
  eastern_bluebird: ["insect", "fruit", "worm"],
  cedar_waxwing: ["fruit", "insect"],
  gray_catbird: ["fruit", "insect"],
  brown_thrasher: ["insect", "fruit", "worm"],
  song_sparrow: ["seed", "insect"],
  white_throated_sparrow: ["seed", "insect", "fruit"],
  chipping_sparrow: ["seed", "insect"],
  dark_eyed_junco: ["seed", "insect"],
  red_winged_blackbird: ["seed", "insect", "grain"],
  common_grackle: ["seed", "grain", "insect"],
  baltimore_oriole: ["nectar", "fruit", "insect"],
  scarlet_tanager: ["insect", "fruit"],
  rose_breasted_grosbeak: ["seed", "fruit", "insect"],
  indigo_bunting: ["seed", "insect"],
  tree_swallow: ["insect"],
  barn_swallow: ["insect"],
  ruby_throated_hummingbird: ["nectar"],
  mourning_dove: ["seed", "grain"],
  wild_turkey: ["seed", "grain", "insect"],
  ruffed_grouse: ["fruit", "seed", "insect"],
  spruce_grouse: ["fruit", "seed", "insect"],
  american_woodcock: ["worm"],
  killdeer: ["worm", "insect"],
  piping_plover: ["worm", "insect"],
  great_blue_heron: ["fish"],
  green_heron: ["fish"],
  belted_kingfisher: ["fish"],
  osprey: ["fish"],
  bald_eagle: ["fish", "prey"],
  red_tailed_hawk: ["prey"],
  coopers_hawk: ["prey"],
  barred_owl: ["prey"],
  great_horned_owl: ["prey"],
  common_loon: ["fish"],
  canada_goose: ["grain", "aquatic"],
  mallard: ["aquatic", "grain", "seed"],
  wood_duck: ["aquatic", "seed", "fruit"],
  common_eider: ["fish", "aquatic"],
  atlantic_puffin: ["fish"],
  black_guillemot: ["fish"],
  herring_gull: ["fish", "prey", "grain"],
  common_tern: ["fish"],
  common_raven: ["prey", "grain", "fruit"],
  peregrine_falcon: ["prey"],
};

/** Generalist diet for photographed "wild" birds we don't have data for. */
const WILD_DIET: DietTag[] = ["seed", "insect", "fruit", "worm"];

export function dietOf(speciesKey: string | null | undefined): DietTag[] {
  if (!speciesKey) return WILD_DIET;
  return DIET_BY_SPECIES[speciesKey] ?? WILD_DIET;
}

export function canEat(speciesKey: string | null | undefined, foodKey: string): boolean {
  const food = FOOD_BY_KEY[foodKey];
  if (!food) return false;
  return dietOf(speciesKey).includes(food.tag);
}

/** Foods a species can eat, in catalog order. */
export function foodsForSpecies(speciesKey: string | null | undefined): FoodItem[] {
  return FOOD_ITEMS.filter((f) => dietOf(speciesKey).includes(f.tag));
}

/** Human-readable diet, e.g. "seeds, suet & insects". */
export function dietLabel(speciesKey: string | null | undefined): string {
  const tags = dietOf(speciesKey);
  const labels = tags.map((t) => DIET_META[t].label.toLowerCase());
  if (labels.length === 1) return labels[0];
  return labels.slice(0, -1).join(", ") + " & " + labels[labels.length - 1];
}

/* ── accessories (worn on a bird) ──────────────────────────────────────── */
export type AccessorySlot = "head" | "face" | "neck";

export interface Accessory {
  key: string;
  name: string;
  emoji: string;
  slot: AccessorySlot;
  cost: number;
}

export const ACCESSORIES: Accessory[] = [
  { key: "ball_cap", name: "Ball Cap", emoji: "🧢", slot: "head", cost: 25 },
  { key: "bow", name: "Ribbon Bow", emoji: "🎀", slot: "head", cost: 30 },
  { key: "flower_crown", name: "Flower Crown", emoji: "🌸", slot: "head", cost: 35 },
  { key: "top_hat", name: "Top Hat", emoji: "🎩", slot: "head", cost: 45 },
  { key: "headphones", name: "Headphones", emoji: "🎧", slot: "head", cost: 55 },
  { key: "crown", name: "Gold Crown", emoji: "👑", slot: "head", cost: 95 },
  { key: "glasses", name: "Round Glasses", emoji: "👓", slot: "face", cost: 25 },
  { key: "sunglasses", name: "Sunglasses", emoji: "🕶️", slot: "face", cost: 45 },
  { key: "scarf", name: "Cozy Scarf", emoji: "🧣", slot: "neck", cost: 35 },
  { key: "necklace", name: "Bead Necklace", emoji: "📿", slot: "neck", cost: 40 },
];
export const ACCESSORY_BY_KEY: Record<string, Accessory> = Object.fromEntries(ACCESSORIES.map((a) => [a.key, a]));

/* ── decor (placed around the nest) ────────────────────────────────────── */
export interface Decor {
  key: string;
  name: string;
  emoji: string;
  cost: number;
}

export const DECOR_ITEMS: Decor[] = [
  { key: "mushrooms", name: "Toadstools", emoji: "🍄", cost: 20 },
  { key: "sunflowers", name: "Sunflowers", emoji: "🌻", cost: 25 },
  { key: "lantern", name: "Paper Lantern", emoji: "🏮", cost: 30 },
  { key: "tulips", name: "Tulip Patch", emoji: "🌷", cost: 30 },
  { key: "pine_tree", name: "Little Pine", emoji: "🌲", cost: 40 },
  { key: "bird_house", name: "Bird House", emoji: "🏠", cost: 60 },
  { key: "fountain", name: "Stone Fountain", emoji: "⛲", cost: 75 },
  { key: "rainbow", name: "Rainbow", emoji: "🌈", cost: 120 },
];
export const DECOR_BY_KEY: Record<string, Decor> = Object.fromEntries(DECOR_ITEMS.map((d) => [d.key, d]));

/* ── breeding ──────────────────────────────────────────────────────────── */
export const EGG_INCUBATION_MIN = 30;
export const MAX_EGGS = 3;

