"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BirdSprite } from "@/components/game/bird-sprite";
import { archetypeFor, birdLevel, type BirdSpecies } from "@/lib/game/birds";
import { playBirdCall } from "@/lib/game/bird-sounds";
import { petBird } from "@/actions/game";
import type { Mood } from "@/lib/game/mood";

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
  const [left, setLeft] = useState(46);
  const [hopping, setHopping] = useState(false);
  const [pops, setPops] = useState<{ id: number; x: number }[]>([]);
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
  const dayProgress = Math.min(1, Math.max(0, (hour - 6) / 14)); // 6:00 → 20:00
  const sunLeft = 8 + dayProgress * 84;
  const sunTop = 12 + (1 - Math.sin(dayProgress * Math.PI)) * 36;

  // Idle wander during the day; the bird sleeps still at night.
  useEffect(() => {
    if (!species || isNight) return;
    const id = setInterval(() => {
      setLeft(12 + Math.round(Math.random() * 64));
      setHopping(true);
      setTimeout(() => setHopping(false), 600);
    }, 3600);
    return () => clearInterval(id);
  }, [species, isNight]);

  function pet() {
    if (!species) return;
    playBirdCall(archetypeFor(species));
    if (!isNight) {
      setHopping(true);
      setTimeout(() => setHopping(false), 600);
    }
    const id = Date.now();
    setPops((pp) => [...pp, { id, x: left }]);
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

  return (
    <div className="relative h-80 overflow-hidden rounded-3xl sm:h-96" style={{ background: sky }}>
      {/* sun or moon + stars */}
      {isNight ? (
        <>
          <div className="absolute right-8 top-6 h-11 w-11 rounded-full bg-[#f3eecf] shadow-[0_0_24px_6px_rgba(243,238,207,0.4)]" />
          {[
            ["12%", "18%"], ["30%", "10%"], ["48%", "22%"], ["70%", "14%"], ["86%", "30%"], ["22%", "34%"],
          ].map(([l, t], i) => (
            <span key={i} className="absolute h-1 w-1 rounded-full bg-white/80" style={{ left: l, top: t }} />
          ))}
        </>
      ) : (
        <div
          className="absolute h-12 w-12 rounded-full bg-[#ffdf7e] shadow-[0_0_40px_12px_rgba(255,223,126,0.6)]"
          style={{ left: `${sunLeft}%`, top: `${sunTop}%` }}
        />
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
          <button
            type="button"
            onClick={pet}
            aria-label={`Pet ${nickname || species.name}`}
            className="absolute bottom-12 transition-[left] duration-1000 ease-in-out"
            style={{ left: `${left}%` }}
          >
            <div className={hopping ? "bird-hop" : undefined}>
              <BirdSprite species={species} size={150} mood={mood} sleeping={isNight} />
            </div>
            <div className="mx-auto h-2 w-16 rounded-full bg-black/15 blur-sm" />
          </button>

          {isNight && (
            <span className="pointer-events-none absolute text-lg" style={{ left: `calc(${left}% + 70px)`, bottom: "60%" }} aria-hidden>
              💤
            </span>
          )}

          {pops.map((pop) => (
            <span key={pop.id} className="seed-pop pointer-events-none absolute bottom-36 text-2xl" style={{ left: `calc(${pop.x}% + 50px)` }}>
              🌱
            </span>
          ))}

          <div className="absolute left-4 top-4 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-[#5a3d1a] backdrop-blur">
            {nickname || species.name} · Lv {birdLevel(xp)}
          </div>
          <div className="absolute right-4 top-4 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-[#5a3d1a] backdrop-blur">
            {isNight ? "😴 fast asleep" : mood === "happy" ? "😊" : mood === "sleepy" ? "😴" : "🙂"} {isNight ? "" : moodLabel}
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
