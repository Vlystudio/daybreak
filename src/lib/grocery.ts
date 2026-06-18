import { z } from "zod";

/**
 * Types + schemas for the grocery / meal-planner system. Row types mirror the
 * tables in migration 0011; Zod schemas validate form + action input. Safe to
 * import on client or server.
 */

export const STORAGE_LOCATIONS = ["pantry", "fridge", "freezer"] as const;
export type StorageLocation = (typeof STORAGE_LOCATIONS)[number];

export const MEAL_PLAN_DURATIONS = [7, 14, 30] as const;

export const PRICE_SOURCE_KEYS = [
  "official_api",
  "affiliate_api",
  "flyer_upload",
  "receipt_parse",
  "manual",
  "cached_historical",
  "web",
] as const;
export type PriceSourceKey = (typeof PRICE_SOURCE_KEYS)[number];

export const SUPPORTED_STORE_SLUGS = [
  "hannaford",
  "trader-joes",
  "walmart",
  "market-basket",
  "costco",
  "aldi",
  "target",
  "whole-foods",
] as const;

// ── Row types ───────────────────────────────────────────────────────────────
export interface Store {
  id: string;
  slug: string;
  name: string;
  default_pricing_source: PriceSourceKey;
  website: string | null;
}

export interface StoreLocation {
  id: string;
  store_id: string;
  label: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface UserStore {
  id: string;
  store_id: string;
  store_location_id: string | null;
  priority: number;
  distance_miles: number | null;
  enabled: boolean;
  last_price_refresh: string | null;
}

export interface NormalizedIngredient {
  id: string;
  name: string;
  category: string | null;
}

export interface Product {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  size_value: number | null;
  size_unit: string | null;
  upc: string | null;
  normalized_ingredient_id: string | null;
}

export interface ProductPrice {
  id: string;
  product_id: string;
  store_id: string | null;
  store_location_id: string | null;
  price: number | null;
  sale_price: number | null;
  unit_price: number | null;
  unit: string | null;
  package_size: string | null;
  sale_expires: string | null;
  source_key: PriceSourceKey | null;
  is_estimated: boolean;
  recorded_at: string;
}

export interface Recipe {
  id: string;
  created_by: string | null;
  household_id: string | null;
  is_public: boolean;
  source: "user" | "ai" | "stored" | "imported";
  title: string;
  description: string | null;
  instructions: string[];
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  estimated_cost: number | null;
  tags: string[];
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  normalized_ingredient_id: string | null;
  raw_name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  sort: number;
}

export interface PantryItem {
  id: string;
  name: string;
  normalized_ingredient_id: string | null;
  quantity: number | null;
  unit: string | null;
  location: StorageLocation;
  expiration_date: string | null;
  updated_at: string;
}

export interface MealPlan {
  id: string;
  title: string | null;
  duration_days: 7 | 14 | 30;
  start_date: string;
  budget: number | null;
  status: "draft" | "active" | "archived";
  created_at: string;
}

export interface MealPlanDayMeal {
  slot: string; // breakfast | lunch | dinner | snack
  recipe_id: string | null;
  title: string;
  servings: number | null;
}

export interface MealPlanDay {
  id: string;
  meal_plan_id: string;
  date: string;
  meals: MealPlanDayMeal[];
}

export interface ShoppingList {
  id: string;
  meal_plan_id: string | null;
  title: string | null;
  status: "active" | "completed" | "archived";
  estimated_total: number | null;
  estimated_savings: number | null;
  created_at: string;
}

export interface ShoppingListItem {
  id: string;
  shopping_list_id: string;
  store_id: string | null;
  store_location_id: string | null;
  product_id: string | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  estimated_price: number | null;
  price_confirmed: boolean;
  status: "needed" | "owned" | "substituted" | "manual_price" | "purchased";
  substituted_from: string | null;
  notes: string | null;
  sort: number;
}

export interface GrocerySettings {
  weekly_budget: number | null;
  household_size: number;
  max_stores_per_trip: number;
  max_distance_miles: number | null;
  favorites: string[];
  dislikes: string[];
  allergies: string[];
}

export interface NutritionGoals {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
}

// ── Validation schemas (forms / actions) ────────────────────────────────────
export const grocerySettingsSchema = z.object({
  weeklyBudget: z.coerce.number().min(0).max(100000).optional(),
  householdSize: z.coerce.number().int().min(1).max(30).default(1),
  maxStoresPerTrip: z.coerce.number().int().min(1).max(8).default(2),
  maxDistanceMiles: z.coerce.number().min(0).max(500).optional(),
  favorites: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  dislikes: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  allergies: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
});
export type GrocerySettingsInput = z.input<typeof grocerySettingsSchema>;

export const nutritionGoalsSchema = z.object({
  calories: z.coerce.number().int().min(0).max(10000).optional(),
  protein_g: z.coerce.number().int().min(0).max(1000).optional(),
  carbs_g: z.coerce.number().int().min(0).max(2000).optional(),
  fat_g: z.coerce.number().int().min(0).max(1000).optional(),
  fiber_g: z.coerce.number().int().min(0).max(500).optional(),
});

export const pantryItemSchema = z.object({
  name: z.string().trim().min(1, "Name the item").max(120),
  quantity: z.coerce.number().min(0).max(100000).optional(),
  unit: z.string().trim().max(20).optional().or(z.literal("")),
  location: z.enum(STORAGE_LOCATIONS),
  expirationDate: z.string().optional().or(z.literal("")),
});
export type PantryItemInput = z.input<typeof pantryItemSchema>;

export const productPriceSchema = z.object({
  storeId: z.string().uuid("Pick a store"),
  productName: z.string().trim().min(1, "Name the product").max(120),
  brand: z.string().trim().max(60).optional().or(z.literal("")),
  price: z.coerce.number().min(0).max(100000),
  salePrice: z.coerce.number().min(0).max(100000).optional(),
  unit: z.string().trim().max(20).optional().or(z.literal("")),
  packageSize: z.string().trim().max(40).optional().or(z.literal("")),
});
export type ProductPriceInput = z.input<typeof productPriceSchema>;

export const shoppingListItemSchema = z.object({
  shoppingListId: z.string().uuid(),
  name: z.string().trim().min(1, "Name the item").max(120),
  quantity: z.coerce.number().min(0).max(100000).optional(),
  unit: z.string().trim().max(20).optional().or(z.literal("")),
});
export type ShoppingListItemInput = z.input<typeof shoppingListItemSchema>;

export const SHOPPING_ITEM_STATUSES = [
  "needed",
  "owned",
  "substituted",
  "manual_price",
  "purchased",
] as const;
export type ShoppingItemStatus = (typeof SHOPPING_ITEM_STATUSES)[number];

export const mealPlanInputSchema = z.object({
  durationDays: z.coerce.number().int().refine((n) => MEAL_PLAN_DURATIONS.includes(n as 7 | 14 | 30), {
    message: "Pick a supported duration",
  }),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date"),
});
export type MealPlanInput = z.input<typeof mealPlanInputSchema>;

/** Cheapest reasonable price from a set of prices (sale beats regular). */
export function effectivePrice(p: Pick<ProductPrice, "price" | "sale_price">): number | null {
  if (p.sale_price != null && (p.price == null || p.sale_price < p.price)) return p.sale_price;
  return p.price;
}

/** Normalize an ingredient string for matching (e.g. "Organic Cucumbers" -> "cucumber"). */
export function normalizeIngredientName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(organic|fresh|seedless|english|baby|large|small|boneless|skinless|raw)\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
