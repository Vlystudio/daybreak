"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { BirdSprite } from "@/components/game/bird-sprite";
import { archetypeFor, birdLevel, type BirdSpecies } from "@/lib/game/birds";
import { playBirdCall } from "@/lib/game/bird-sounds";
import { petBird } from "@/actions/game";
import type { Mood } from "@/lib/game/mood";

const Bird3D = dynamic(() => import("@/components/game/bird-3d").then((m) => m.Bird3D), { ssr: false });

/** Local hour (0-23.99) in the given timezone. */
function localHourFrac(tz: string, ms: number): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(ms));
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? "8") % 24;
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return h + m / 60;
  } catch {
    const d = new Date(ms);
    return d.getHours() + d.getMinutes() / 60;
  }
}

function Tree({ left, scale, color }: { left: string; scale: number; color: string }) {
  return (
    <div className="absolute bottom-12" style={{ left, transform: `scale(${scale})`, transformOrigin: "bottom center" }} aria-hidden>
      <div className="mx-auto h-10 w-3 rounded-sm bg-[#8a6647]" />
      <div className="absolute -top-12 left-1/2 -translate-x-1/2">
        <div className="h-16 w-16 rounded-full" style={{ background: color }} />
        <div className="absolute -left-5 top-4 h-12 w-12 rounded-full" style={{ background: color }} />
        <div className="absolute -right-5 top-4 h-12 w-12 rounded-full" style={{ background: color }} />
      </div>
    </div>
  );
}

export function NestStage({
  species,
  nickname,
  xp,
  mood = "content",
  moodLabel,
  timezone = "UTC",
}: {
  species: BirdSpecies | null;
  nickname: string | null;
  xp: number;
  mood?: Mood;
  moodLabel?: string;
  timezone?: string;
}) {
  const [pops, setPops] = useState<{ id: number }[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const petting = useRef(false);

  // Tick the clock every minute so the sun/day-night track real local time.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const hour = localHourFrac(timezone, now);
  const isNight = hour < 6 || hour >= 20;
  const isDusk = (hour >= 18 && hour < 20) || (hour >= 6 && hour < 7);
  const dayProgress = Math.min(1, Math.max(0, (hour - 6) / 14));
  const sunLeft = 8 + dayProgress * 84;
  const sunTop = 12 + (1 - Math.sin(dayProgress * Math.PI)) * 36;

  function pet() {
    if (!species) return;
    playBirdCall(archetypeFor(species));
    const id = Date.now();
    setPops((pp) => [...pp, { id }]);
    setTimeout(() => setPops((pp) => pp.filter((x) => x.id !== id)), 900);

    if (petting.current) return;
    petting.current = true;
    petBird()
      .then((r) => {
        if (r.ok && r.seeds && r.seeds > 0) toast.success(`+${r.seeds} 🌱 — your buddy loves the attention.`);
      })
      .finally(() => {
        petting.current = false;
      });
  }

  const sky = isNight
    ? "linear-gradient(to bottom,#1c2440,#2a3358 55%,#3a3d52)"
    : isDusk
      ? "linear-gradient(to bottom,#f4b97a,#f6d6a8 50%,#e9e0bf)"
      : "linear-gradient(to bottom,#bfe3f0,#dff1e3 55%,#f3e7c9)";
  const foliage = isNight ? "#3a5a47" : "#9ed089";

  const sprite2D = species ? (
    <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-8">
      <BirdSprite species={species} size={180} mood={mood} sleeping={isNight} />
    </div>
  ) : null;

  return (
    <div className="relative h-80 overflow-hidden rounded-3xl sm:h-96" style={{ background: sky }}>
      {/* sun or moon + stars */}
      {isNight ? (
        <>
          <div className="absolute right-8 top-6 h-11 w-11 rounded-full bg-[#f3eecf] shadow-[0_0_24px_6px_rgba(243,238,207,0.4)]" />
          {[["12%", "18%"], ["30%", "10%"], ["48%", "22%"], ["70%", "14%"], ["86%", "30%"], ["22%", "34%"]].map(([l, t], i) => (
            <span key={i} className="absolute h-1 w-1 rounded-full bg-white/80" style={{ left: l, top: t }} />
          ))}
        </>
      ) : (
        <div className="absolute h-12 w-12 rounded-full bg-[#ffdf7e] shadow-[0_0_40px_12px_rgba(255,223,126,0.6)]" style={{ left: `${sunLeft}%`, top: `${sunTop}%` }} />
      )}

      {/* hills */}
      <div className="absolute -bottom-12 -left-8 h-36 w-56 rounded-full" style={{ background: isNight ? "#314a3a" : "#bfe0a8" }} />
      <div className="absolute -bottom-16 right-0 h-40 w-64 rounded-full" style={{ background: isNight ? "#2a4030" : "#a9d493" }} />

      {/* trees */}
      <Tree left="6%" scale={1.1} color={foliage} />
      <Tree left="82%" scale={1.3} color={foliage} />
      <Tree left="40%" scale={0.8} color={foliage} />

      {/* ground */}
      <div className="absolute inset-x-0 bottom-0 h-20" style={{ background: isNight ? "#6b5a3f" : "#cdb079" }} />

      {species ? (
        <>
          {/* rotatable 3D companion (falls back to the 2D plush bird) */}
          <div className="absolute inset-0 z-10">
            <Bird3D species={species} sleeping={isNight} night={isNight} onPet={pet} fallback={sprite2D} />
          </div>

          {isNight && (
            <span className="pointer-events-none absolute right-1/3 top-10 z-20 text-lg" aria-hidden>
              💤
            </span>
          )}

          {pops.map((pop) => (
            <span key={pop.id} className="seed-pop pointer-events-none absolute bottom-32 left-1/2 z-20 -translate-x-1/2 text-2xl">
              🌱
            </span>
          ))}

          <div className="absolute left-4 top-4 z-20 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-[#5a3d1a] backdrop-blur">
            {nickname || species.name} · Lv {birdLevel(xp)}
          </div>
          <div className="absolute right-4 top-4 z-20 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-[#5a3d1a] backdrop-blur">
            {isNight ? "😴 fast asleep" : mood === "happy" ? "😊" : mood === "sleepy" ? "😴" : "🙂"} {isNight ? "" : moodLabel}
          </div>
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-white/55 px-2.5 py-0.5 text-[10px] text-[#5a3d1a] backdrop-blur">
            drag to spin · tap to pet
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-[#5a3d1a]">
          <p className="text-sm font-medium">Your nest is empty</p>
          <p className="mt-1 max-w-xs text-xs opacity-80">Earn seeds by doing your daily tasks, then hatch your first bird below.</p>
        </div>
      )}
    </div>
  );
}
