"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { birdAsset } from "@/data/birds";

/**
 * Drag-to-turn companion. The bird has three illustrated frames — left,
 * front, right — generated from the same source sprite, so it reads as one
 * bird turning. Dragging horizontally rotates between them; a tap (no drag)
 * pets it. Falls back to the front frame if a side frame is missing.
 */
export function BirdTurntable({
  speciesKey,
  name,
  size = 200,
  sleeping = false,
  onPet,
}: {
  speciesKey: string;
  name: string;
  size?: number;
  sleeping?: boolean;
  onPet?: () => void;
}) {
  const front = birdAsset(speciesKey) ?? "";
  const frames = [`/assets/birds/${speciesKey}_l.png`, front, `/assets/birds/${speciesKey}_r.png`];
  const [idx, setIdx] = useState(1);
  const drag = useRef({ x: 0, moved: false, active: false });

  function down(e: React.PointerEvent) {
    drag.current = { x: e.clientX, moved: false, active: true };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.x;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    setIdx(Math.max(0, Math.min(2, 1 + Math.round(dx / 45))));
  }
  function up() {
    if (drag.current.active && !drag.current.moved) onPet?.();
    drag.current.active = false;
  }

  return (
    <div
      className="select-none"
      style={{ width: size, height: size, touchAction: "none", cursor: "grab" }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={frames[idx] || front}
        alt={name}
        width={size}
        height={size}
        draggable={false}
        onError={(e) => {
          if (front && e.currentTarget.src !== location.origin + front) e.currentTarget.src = front;
        }}
        className={cn("h-full w-full object-contain", sleeping && "opacity-90 saturate-[0.85]")}
      />
    </div>
  );
}
