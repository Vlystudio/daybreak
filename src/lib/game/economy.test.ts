import { describe, it, expect } from "vitest";
import { RARITY_META, sellValueFor, type Rarity } from "./birds";

/**
 * The sell value is now computed in the database (public.bird_sell_value in
 * supabase/migrations/0045_game_economy_rpcs.sql) so it can't be tampered with
 * from the client. This guard keeps the TypeScript catalog and the SQL CASE in
 * lockstep — if you change one, this test forces you to change the other.
 */
const DB_SELL_VALUE: Record<Rarity, number> = {
  common: 10,
  uncommon: 25,
  rare: 75,
  epic: 200,
  legendary: 500,
  wild: 50,
};

describe("bird sell-value parity (TS RARITY_META ↔ DB bird_sell_value)", () => {
  it("every rarity's TS sell value matches the DB mapping", () => {
    for (const rarity of Object.keys(DB_SELL_VALUE) as Rarity[]) {
      expect(sellValueFor(rarity)).toBe(DB_SELL_VALUE[rarity]);
      expect(RARITY_META[rarity].sellValue).toBe(DB_SELL_VALUE[rarity]);
    }
  });

  it("covers every rarity tier in the catalog", () => {
    for (const rarity of Object.keys(RARITY_META) as Rarity[]) {
      expect(DB_SELL_VALUE[rarity]).toBeDefined();
    }
  });
});
