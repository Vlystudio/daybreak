/**
 * Shopping + trip optimization. Pure functions over priced items — provider/UI
 * agnostic and unit-testable. Prices are whatever the engine has (with their
 * confidence/estimated flags handled upstream).
 */

export interface PriceOption {
  storeId: string;
  storeName: string;
  price: number; // effective (sale-aware) unit price
  isEstimated: boolean;
}

export interface OptimizerItem {
  name: string;
  quantity: number;
  options: PriceOption[]; // one per store that has a price for this item
}

export interface StoreAllocation {
  storeId: string;
  storeName: string;
  items: { name: string; quantity: number; price: number; isEstimated: boolean }[];
  subtotal: number;
}

export interface CheapestAllocation {
  allocations: StoreAllocation[];
  total: number;
  unpricedItems: string[];
  hasEstimates: boolean;
}

/** Assign each item to its cheapest store; group into per-store lists. */
export function allocateCheapest(items: OptimizerItem[]): CheapestAllocation {
  const byStore = new Map<string, StoreAllocation>();
  const unpriced: string[] = [];
  let hasEstimates = false;

  for (const item of items) {
    if (item.options.length === 0) {
      unpriced.push(item.name);
      continue;
    }
    const best = item.options.reduce((a, b) => (b.price < a.price ? b : a));
    if (best.isEstimated) hasEstimates = true;
    const alloc =
      byStore.get(best.storeId) ??
      { storeId: best.storeId, storeName: best.storeName, items: [], subtotal: 0 };
    const lineCost = best.price * item.quantity;
    alloc.items.push({ name: item.name, quantity: item.quantity, price: best.price, isEstimated: best.isEstimated });
    alloc.subtotal = Math.round((alloc.subtotal + lineCost) * 100) / 100;
    byStore.set(best.storeId, alloc);
  }

  const allocations = Array.from(byStore.values()).sort((a, b) => b.subtotal - a.subtotal);
  const total = Math.round(allocations.reduce((s, a) => s + a.subtotal, 0) * 100) / 100;
  return { allocations, total, unpricedItems: unpriced, hasEstimates };
}

export interface SingleStoreResult {
  storeId: string;
  storeName: string;
  total: number;
  coveredItems: number;
  totalItems: number;
  missingItems: string[];
}

/** Cheapest single store that covers the most items. */
export function bestSingleStore(items: OptimizerItem[]): SingleStoreResult | null {
  const stores = new Map<string, string>();
  for (const item of items) for (const o of item.options) stores.set(o.storeId, o.storeName);
  if (stores.size === 0) return null;

  let best: SingleStoreResult | null = null;
  for (const [storeId, storeName] of stores) {
    let total = 0;
    let covered = 0;
    const missing: string[] = [];
    for (const item of items) {
      const opt = item.options.find((o) => o.storeId === storeId);
      if (opt) {
        total += opt.price * item.quantity;
        covered++;
      } else {
        missing.push(item.name);
      }
    }
    total = Math.round(total * 100) / 100;
    const candidate: SingleStoreResult = {
      storeId,
      storeName,
      total,
      coveredItems: covered,
      totalItems: items.length,
      missingItems: missing,
    };
    if (
      !best ||
      candidate.coveredItems > best.coveredItems ||
      (candidate.coveredItems === best.coveredItems && candidate.total < best.total)
    ) {
      best = candidate;
    }
  }
  return best;
}

export interface TripRecommendation {
  recommendation: "multi" | "single";
  reason: string;
  multiTotal: number;
  storesInMultiTrip: number;
  singleTotal: number | null;
  singleStoreName: string | null;
  singleCoversAll: boolean;
  grossSavings: number; // single - multi (ignores driving)
  extraDrivingCost: number;
  netSavings: number;
  extraMinutes: number;
}

const DEFAULT_FUEL_COST_PER_MILE = 0.2;
const DEFAULT_MINUTES_PER_STORE = 16;
const SAVINGS_THRESHOLD = 4; // below this net, prefer fewer stores

/** Compare the cheapest multi-store split vs a single-store trip. */
export function optimizeTrip(params: {
  items: OptimizerItem[];
  storeDistanceMiles?: Record<string, number>;
  fuelCostPerMile?: number;
  minutesPerStore?: number;
  maxStores?: number;
}): TripRecommendation {
  const distances = params.storeDistanceMiles ?? {};
  const fuel = params.fuelCostPerMile ?? DEFAULT_FUEL_COST_PER_MILE;
  const minutesPerStore = params.minutesPerStore ?? DEFAULT_MINUTES_PER_STORE;

  const multi = allocateCheapest(params.items);
  const single = bestSingleStore(params.items);
  const multiStoreCount = multi.allocations.length;

  const singleCoversAll = single ? single.missingItems.length === 0 : false;
  const singleTotal = single ? single.total : null;

  const round = (n: number) => Math.round(n * 100) / 100;
  const driveCost = (storeIds: string[]) =>
    storeIds.reduce((s, id) => s + (distances[id] ?? 0) * 2 * fuel, 0);

  const multiDrive = driveCost(multi.allocations.map((a) => a.storeId));
  const singleDrive = single ? driveCost([single.storeId]) : 0;
  const extraDrivingCost = round(Math.max(0, multiDrive - singleDrive));
  const extraMinutes = Math.max(0, multiStoreCount - 1) * minutesPerStore;

  const grossSavings = singleTotal != null ? round(singleTotal - multi.total) : 0;
  const netSavings = round(grossSavings - extraDrivingCost);

  // Decide.
  let recommendation: "multi" | "single" = "multi";
  let reason: string;
  const overStoreLimit = params.maxStores != null && multiStoreCount > params.maxStores;

  if (!single || !singleCoversAll) {
    recommendation = "multi";
    reason = "No single store carries everything, so splitting the trip is required.";
  } else if (overStoreLimit) {
    recommendation = "single";
    reason = `Splitting needs ${multiStoreCount} stores (over your ${params.maxStores}-store limit). Buying everything at ${single.storeName} keeps it simple.`;
  } else if (multiStoreCount <= 1) {
    recommendation = "single";
    reason = `Everything's cheapest at ${single.storeName} anyway — one stop.`;
  } else if (netSavings < SAVINGS_THRESHOLD) {
    recommendation = "single";
    reason = `Splitting across ${multiStoreCount} stores saves about $${grossSavings.toFixed(
      2
    )}, but adds ~${extraMinutes} min of driving${
      extraDrivingCost > 0 ? ` and $${extraDrivingCost.toFixed(2)} in fuel` : ""
    }. Recommend buying everything at ${single.storeName}.`;
  } else {
    recommendation = "multi";
    reason = `Splitting across ${multiStoreCount} stores nets about $${netSavings.toFixed(
      2
    )} after driving — worth the extra stops.`;
  }

  return {
    recommendation,
    reason,
    multiTotal: multi.total,
    storesInMultiTrip: multiStoreCount,
    singleTotal,
    singleStoreName: single?.storeName ?? null,
    singleCoversAll,
    grossSavings,
    extraDrivingCost,
    netSavings,
    extraMinutes,
  };
}
