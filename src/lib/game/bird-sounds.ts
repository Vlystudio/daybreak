import type { BirdArchetype } from "@/lib/game/birds";

/**
 * Procedurally-synthesized bird calls (Web Audio). Each archetype gets a
 * distinct "voice" — a chirpy songbird trill, a low owl hoot, a harsh crow caw,
 * a parrot squawk, etc. These are original synthesized sounds, not recordings,
 * so there are no audio assets or licensing to worry about. Client-only.
 */

interface NoteSpec {
  f: number; // start frequency (Hz)
  f2?: number; // optional glide-to frequency
  type?: OscillatorType;
  at: number; // start offset (s)
  dur: number; // duration (s)
  g?: number; // peak gain 0..1 (relative)
}

const rep = (n: number, fn: (i: number) => NoteSpec): NoteSpec[] => Array.from({ length: n }, (_, i) => fn(i));

const VOICES: Record<BirdArchetype, NoteSpec[]> = {
  // bright chirpy trill — chickadees, sparrows, finches, warblers
  songbird: [
    { f: 2200, f2: 2700, type: "triangle", at: 0, dur: 0.07 },
    { f: 2700, f2: 2000, type: "triangle", at: 0.09, dur: 0.07 },
    { f: 2400, f2: 2900, type: "triangle", at: 0.19, dur: 0.07 },
    { f: 2800, f2: 2300, type: "triangle", at: 0.28, dur: 0.08 },
  ],
  // clear down-slurred whistles — "cheer cheer cheer"
  cardinal: [
    { f: 2700, f2: 1500, type: "sine", at: 0, dur: 0.22, g: 0.85 },
    { f: 2700, f2: 1500, type: "sine", at: 0.3, dur: 0.22, g: 0.85 },
    { f: 1900, f2: 1500, type: "sine", at: 0.62, dur: 0.16, g: 0.8 },
  ],
  // harsh jeer / rattle — jays & kingfishers
  jay: [
    { f: 1300, f2: 700, type: "sawtooth", at: 0, dur: 0.16, g: 0.45 },
    { f: 1250, f2: 680, type: "sawtooth", at: 0.22, dur: 0.16, g: 0.45 },
  ],
  // dry caw — crows, ravens, grackles, blackbirds
  corvid: [
    { f: 540, f2: 480, type: "sawtooth", at: 0, dur: 0.14, g: 0.5 },
    { f: 520, f2: 460, type: "sawtooth", at: 0.2, dur: 0.14, g: 0.5 },
  ],
  // drum roll on a trunk
  woodpecker: rep(8, (i) => ({ f: 200, type: "square", at: i * 0.04, dur: 0.02, g: 0.55 })),
  // piercing screech — hawks, eagles, falcons, osprey
  raptor: [{ f: 2500, f2: 850, type: "sawtooth", at: 0, dur: 0.5, g: 0.32 }],
  // soft low hoot
  owl: [
    { f: 300, f2: 280, type: "sine", at: 0, dur: 0.28, g: 0.95 },
    { f: 250, f2: 235, type: "sine", at: 0.42, dur: 0.36, g: 0.95 },
  ],
  // wing-hum buzz
  hummingbird: rep(9, (i) => ({ f: 3100 + (i % 2) * 250, type: "triangle", at: i * 0.04, dur: 0.035, g: 0.5 })),
  // gentle coo
  dove: [
    { f: 470, f2: 430, type: "sine", at: 0, dur: 0.18, g: 0.9 },
    { f: 430, f2: 400, type: "sine", at: 0.22, dur: 0.3, g: 0.9 },
  ],
  // nasal quacks
  duck: [
    { f: 640, f2: 560, type: "sawtooth", at: 0, dur: 0.12, g: 0.42 },
    { f: 600, f2: 520, type: "sawtooth", at: 0.17, dur: 0.12, g: 0.42 },
    { f: 560, f2: 480, type: "sawtooth", at: 0.34, dur: 0.14, g: 0.4 },
  ],
  // two-tone honk
  goose: [
    { f: 330, f2: 420, type: "sawtooth", at: 0, dur: 0.22, g: 0.5 },
    { f: 300, f2: 380, type: "sawtooth", at: 0.3, dur: 0.26, g: 0.5 },
  ],
  // haunting wail that rises then falls
  loon: [
    { f: 700, f2: 1150, type: "sine", at: 0, dur: 0.42, g: 0.9 },
    { f: 1150, f2: 600, type: "sine", at: 0.42, dur: 0.5, g: 0.9 },
  ],
  // descending laugh
  gull: rep(5, (i) => ({ f: 1700 - i * 180, type: "sawtooth", at: i * 0.13, dur: 0.09, g: 0.4 })),
  // low seabird growl — puffins, guillemots
  seabird: [{ f: 150, f2: 120, type: "sawtooth", at: 0, dur: 0.55, g: 0.5 }],
  // turkey-ish rapid gobble
  gamebird: rep(10, (i) => ({ f: 360 + (i % 3) * 130, type: "square", at: i * 0.045, dur: 0.035, g: 0.36 })),
  // high piping whistle
  shorebird: rep(4, (i) => ({ f: 2600 + i * 220, type: "triangle", at: i * 0.13, dur: 0.09, g: 0.5 })),
  // harsh wader squawk
  wader: [{ f: 520, f2: 200, type: "sawtooth", at: 0, dur: 0.34, g: 0.45 }],
  // liquid twitter
  swallow: rep(6, (i) => ({ f: 2800 + (i % 2) * 500, f2: 2400 + (i % 2) * 500, type: "triangle", at: i * 0.06, dur: 0.05, g: 0.42 })),
};

let audio: AudioContext | null = null;
function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audio) audio = new AC();
    if (audio.state === "suspended") void audio.resume();
    return audio;
  } catch {
    return null;
  }
}

export function playBirdCall(archetype: BirdArchetype): void {
  const ac = context();
  if (!ac) return;
  const notes = VOICES[archetype] ?? VOICES.songbird;
  const master = ac.createGain();
  master.gain.value = 0.18; // keep it gentle
  master.connect(ac.destination);

  const t0 = ac.currentTime + 0.01;
  for (const n of notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = n.type ?? "triangle";
    const start = t0 + n.at;
    const end = start + n.dur;
    osc.frequency.setValueAtTime(n.f, start);
    if (n.f2 != null) osc.frequency.linearRampToValueAtTime(n.f2, end);
    const peak = n.g ?? 1;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}
