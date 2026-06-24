"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { birdAsset } from "@/data/birds";
import { AccessoryOverlay } from "@/components/game/accessory-overlay";

/**
 * Drag-to-turn companion. The bird has five illustrated frames spanning ~180°
 * (left profile → left 3/4 → front → right 3/4 → right profile), all generated
 * from its own front sprite so it stays the same bird. Dragging scrubs a
 * continuous position and we cross-fade between adjacent frames, so it glides
 * instead of snapping; when idle it gently sways for life. A tap (no drag) pets
 * it. Missing side frames fall back to the front view.
 */
export function BirdTurntable({
  speciesKey,
  name,
  size = 200,
  sleeping = false,
  accessoryKey = null,
  onPet,
}: {
  speciesKey: string;
  name: string;
  size?: number;
  sleeping?: boolean;
  accessoryKey?: string | null;
  onPet?: () => void;
}) {
  const front = birdAsset(speciesKey) ?? "";
  const frames = [
    `/assets/birds/${speciesKey}_ll.png`,
    `/assets/birds/${speciesKey}_l.png`,
    front,
    `/assets/birds/${speciesKey}_r.png`,
    `/assets/birds/${speciesKey}_rr.png`,
  ];
  const N = frames.length;
  const FRONT = 2;

  const posRef = useRef(FRONT);
  const [pos, setPos] = useState(FRONT);
  const drag = useRef({ x: 0, startPos: FRONT, moved: false, active: false });

  // Render loop: gentle idle sway when not dragging.
  useEffect(() => {
    if (sleeping) {
      posRef.current = FRONT;
      return;
    }
    let raf = 0;
    const loop = (t: number) => {
      if (!drag.current.active) {
        const target = FRONT + Math.sin(t / 1000 * 0.55) * 0.6;
        posRef.current += (target - posRef.current) * 0.045;
        setPos(posRef.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sleeping]);

  function down(e: React.PointerEvent) {
    drag.current = { x: e.clientX, startPos: posRef.current, moved: false, active: true };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    if (!drag.current.active || sleeping) return;
    const dx = e.clientX - drag.current.x;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    posRef.current = Math.max(0, Math.min(N - 1, drag.current.startPos + dx / 46));
    setPos(posRef.current);
  }
  function up() {
    if (drag.current.active && !drag.current.moved) onPet?.();
    drag.current.active = false;
  }

  const p = sleeping ? FRONT : pos;
  const base = Math.max(0, Math.min(N - 1, Math.floor(p)));
  const next = Math.min(N - 1, base + 1);
  const frac = sleeping ? 0 : p - base;
  const onErr = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (front && !e.currentTarget.src.endsWith(front)) e.currentTarget.src = front;
  };

  return (
    <div
      className="relative select-none"
      style={{ width: size, height: size, touchAction: "none", cursor: "grab" }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {/* eslint-disable @next/next/no-img-element */}
      <img
        src={frames[base] || front}
        alt={name}
        draggable={false}
        onError={onErr}
        className={cn("absolute inset-0 h-full w-full object-contain", sleeping && "opacity-90 saturate-[0.85]")}
      />
      <img
        src={frames[next] || front}
        alt=""
        aria-hidden
        draggable={false}
        onError={onErr}
        className="absolute inset-0 h-full w-full object-contain"
        style={{ opacity: frac }}
      />
      {/* eslint-enable @next/next/no-img-element */}
      {accessoryKey && <AccessoryOverlay accessoryKey={accessoryKey} size={size} />}
    </div>
  );
}
