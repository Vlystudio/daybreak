"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BirdSprite } from "@/components/game/bird-sprite";
import { birdLevel, type BirdSpecies } from "@/lib/game/birds";
import { petBird } from "@/actions/game";

/**
 * The living nest: the active companion idly hops around its perch and reacts
 * when tapped (a hop + a little affection bonus). Original art + CSS motion.
 */
export function NestStage({
  species,
  nickname,
  xp,
  mood = "content",
  moodLabel,
}: {
  species: BirdSpecies | null;
  nickname: string | null;
  xp: number;
  mood?: import("@/lib/game/mood").Mood;
  moodLabel?: string;
}) {
  const [left, setLeft] = useState(46);
  const [hopping, setHopping] = useState(false);
  const [pops, setPops] = useState<{ id: number; x: number }[]>([]);
  const petting = useRef(false);

  // Idle wander: drift to a new spot every few seconds with a little hop.
  useEffect(() => {
    if (!species) return;
    const id = setInterval(() => {
      setLeft(12 + Math.round(Math.random() * 64));
      setHopping(true);
      setTimeout(() => setHopping(false), 600);
    }, 3600);
    return () => clearInterval(id);
  }, [species]);

  function pet() {
    if (!species) return;
    setHopping(true);
    setTimeout(() => setHopping(false), 600);
    const id = Date.now();
    setPops((p) => [...p, { id, x: left }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 900);

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

  return (
    <div className="relative h-64 overflow-hidden rounded-3xl bg-gradient-to-b from-[#bfe3f0] via-[#dff1e3] to-[#f3e7c9]">
      {/* sun */}
      <div className="absolute right-6 top-5 h-12 w-12 rounded-full bg-[#ffdf7e] shadow-[0_0_40px_12px_rgba(255,223,126,0.6)]" />
      {/* hills */}
      <div className="absolute -bottom-10 -left-6 h-28 w-44 rounded-full bg-[#bfe0a8]" />
      <div className="absolute -bottom-12 right-0 h-32 w-52 rounded-full bg-[#a9d493]" />
      {/* ground */}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-[#cdb079]" />

      {species ? (
        <>
          <button
            type="button"
            onClick={pet}
            aria-label={`Pet ${nickname || species.name}`}
            className="absolute bottom-10 transition-[left] duration-1000 ease-in-out"
            style={{ left: `${left}%` }}
          >
            <div className={hopping ? "bird-hop" : undefined}>
              <BirdSprite species={species} size={120} mood={mood} />
            </div>
            {/* shadow */}
            <div className="mx-auto h-2 w-16 rounded-full bg-black/15 blur-sm" />
          </button>

          {pops.map((pop) => (
            <span
              key={pop.id}
              className="seed-pop pointer-events-none absolute bottom-32 text-2xl"
              style={{ left: `calc(${pop.x}% + 38px)` }}
            >
              🌱
            </span>
          ))}

          <div className="absolute left-4 top-4 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-[#5a3d1a] backdrop-blur">
            {nickname || species.name} · Lv {birdLevel(xp)}
          </div>
          {moodLabel && (
            <div className="absolute right-4 top-4 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-[#5a3d1a] backdrop-blur">
              {mood === "happy" ? "😊" : mood === "sleepy" ? "😴" : "🙂"} {moodLabel}
            </div>
          )}
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
