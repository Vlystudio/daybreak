import { ACCESSORY_BY_KEY } from "@/lib/game/shop";

/**
 * Renders an equipped accessory emoji over a bird sprite. Positioned by slot
 * (head / face / neck) within a `size`×`size` square. Approximate — it reads as
 * "wearing a hat/glasses/scarf" across the illustrated species without per-bird
 * anchors. Must sit inside a `position: relative` container.
 */
export function AccessoryOverlay({ accessoryKey, size }: { accessoryKey: string; size: number }) {
  const a = ACCESSORY_BY_KEY[accessoryKey];
  if (!a) return null;
  const cfg =
    a.slot === "head"
      ? { top: size * 0.0, font: size * 0.36 }
      : a.slot === "face"
        ? { top: size * 0.26, font: size * 0.24 }
        : { top: size * 0.52, font: size * 0.3 };
  return (
    <span
      className="pointer-events-none absolute left-1/2 -translate-x-1/2 leading-none drop-shadow"
      style={{ top: cfg.top, fontSize: cfg.font }}
      aria-hidden
    >
      {a.emoji}
    </span>
  );
}
