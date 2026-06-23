import { archetypeFor, type BirdSpecies, type BirdPalette, type BirdArchetype } from "@/lib/game/birds";
import type { Mood } from "@/lib/game/mood";

/**
 * Original, parametric SVG bird. The species' archetype drives a distinct
 * silhouette (owl vs flamingo vs penguin vs songbird…), and the palette + crest
 * / long-tail flags colour and accent it. CSS classes drive the idle motion.
 * Stylized — not photoreal — but each archetype reads as a different bird.
 */
export function BirdSprite({
  species,
  size = 120,
  animated = true,
  mood = "content",
  sleeping = false,
  className,
}: {
  species: BirdSpecies;
  size?: number;
  animated?: boolean;
  mood?: Mood;
  sleeping?: boolean;
  className?: string;
}) {
  const p = species.palette;
  const arch = archetypeFor(species);
  const a = animated && !sleeping;

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} role="img" aria-label={species.name}>
      <g className={a ? "bird-bob" : undefined} style={{ transformOrigin: "60px 112px" }}>
        {renderArchetype(arch, p, { crest: !!species.crest, longTail: !!species.longTail, mood, sleeping, animated: a })}
      </g>
    </svg>
  );
}

interface Opts {
  crest: boolean;
  longTail: boolean;
  mood: Mood;
  sleeping: boolean;
  animated: boolean;
}

function Eyes({ cx, cy, r, gap, mood, sleeping, animated }: { cx: number; cy: number; r: number; gap: number; mood: Mood; sleeping: boolean; animated: boolean }) {
  const dark = "#2a2320";
  if (sleeping || mood === "sleepy") {
    return (
      <g stroke={dark} strokeWidth={2.2} strokeLinecap="round" fill="none">
        <path d={`M${cx - gap - 3} ${cy} Q${cx - gap} ${cy + 3} ${cx - gap + 3} ${cy}`} />
        <path d={`M${cx + gap - 3} ${cy} Q${cx + gap} ${cy + 3} ${cx + gap + 3} ${cy}`} />
      </g>
    );
  }
  const dy = mood === "happy" ? -1 : 0;
  return (
    <g className={animated ? "bird-blink" : undefined} style={{ transformOrigin: `${cx}px ${cy}px` }}>
      <circle cx={cx - gap} cy={cy} r={r} fill="#fff" />
      <circle cx={cx + gap} cy={cy} r={r} fill="#fff" />
      <circle cx={cx - gap + 1} cy={cy + dy} r={r * 0.52} fill={dark} />
      <circle cx={cx + gap + 1} cy={cy + dy} r={r * 0.52} fill={dark} />
      <circle cx={cx - gap + 2} cy={cy - 1 + dy} r={r * 0.18} fill="#fff" />
      <circle cx={cx + gap + 2} cy={cy - 1 + dy} r={r * 0.18} fill="#fff" />
    </g>
  );
}

function Legs({ x1, x2, y, h, color, long = false }: { x1: number; x2: number; y: number; h: number; color: string; long?: boolean }) {
  return (
    <g stroke={color} strokeWidth={long ? 2.6 : 3} strokeLinecap="round">
      <line x1={x1} y1={y} x2={x1} y2={y + h} />
      <line x1={x2} y1={y} x2={x2} y2={y + h} />
      {long && (
        <>
          <line x1={x1} y1={y + h} x2={x1 - 3} y2={y + h + 2} />
          <line x1={x2} y1={y + h} x2={x2 + 3} y2={y + h + 2} />
        </>
      )}
    </g>
  );
}

function Crest({ x, y, color }: { x: number; y: number; color: string }) {
  return <path d={`M${x} ${y} C${x - 4} ${y - 10} ${x} ${y - 14} ${x + 2} ${y - 16} C${x + 2} ${y - 8} ${x + 6} ${y - 4} ${x + 10} ${y} C${x + 6} ${y - 1} ${x + 2} ${y} ${x} ${y + 4} Z`} fill={color} />;
}

function renderArchetype(arch: BirdArchetype, p: BirdPalette, o: Opts) {
  const wing = (cx: number, cy: number, rx: number, ry: number, origin: string) => (
    <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={p.wing} className={o.animated ? "bird-wing" : undefined} style={{ transformOrigin: origin }} />
  );
  const beakTri = (x: number, y: number, w: number, h: number) => <path d={`M${x - w} ${y} L${x + w} ${y} L${x} ${y + h} Z`} fill={p.beak} />;

  switch (arch) {
    case "owl":
      return (
        <>
          <ellipse cx="60" cy="74" rx="32" ry="30" fill={p.body} />
          <ellipse cx="60" cy="80" rx="20" ry="22" fill={p.belly} />
          {/* ear tufts */}
          <path d="M40 40 l-4 -16 l10 8 Z" fill={p.wing} />
          <path d="M80 40 l4 -16 l-10 8 Z" fill={p.wing} />
          <circle cx="60" cy="46" r="28" fill={p.body} />
          {/* facial disc */}
          <ellipse cx="49" cy="46" rx="12" ry="15" fill={p.belly} opacity="0.6" />
          <ellipse cx="71" cy="46" rx="12" ry="15" fill={p.belly} opacity="0.6" />
          <Legs x1={52} x2={68} y={101} h={6} color={p.beak} />
          <Eyes cx={60} cy={46} r={8} gap={11} mood={o.mood} sleeping={o.sleeping} animated={o.animated} />
          <path d="M57 52 L63 52 L60 60 Z" fill={p.beak} />
        </>
      );

    case "raptor":
      return (
        <>
          {wing(82, 66, 12, 26, "74px 50px")}
          <ellipse cx="60" cy="70" rx="24" ry="30" fill={p.body} />
          <ellipse cx="60" cy="76" rx="15" ry="22" fill={p.belly} />
          <circle cx="60" cy="38" r="19" fill={p.body} />
          {/* brow */}
          <path d="M44 34 Q60 26 76 34" stroke={p.wing} strokeWidth="4" fill="none" strokeLinecap="round" />
          <Legs x1={52} x2={68} y={98} h={8} color={p.beak} long />
          <Eyes cx={60} cy={40} r={5.5} gap={8} mood={o.mood} sleeping={o.sleeping} animated={o.animated} />
          {/* hooked beak */}
          <path d="M58 46 L66 46 Q66 52 60 53 Q61 49 58 46 Z" fill={p.beak} />
        </>
      );

    case "parrot":
      return (
        <>
          {o.longTail ? <path d="M62 84 C66 102 66 116 64 120 C72 110 76 96 74 86 Z" fill={p.wing} /> : null}
          {wing(80, 68, 12, 24, "72px 52px")}
          <ellipse cx="60" cy="72" rx="24" ry="29" fill={p.body} />
          <ellipse cx="58" cy="78" rx="14" ry="20" fill={p.belly} />
          <circle cx="58" cy="40" r="19" fill={p.body} />
          {o.crest && <Crest x={56} y={26} color={p.wing} />}
          <Legs x1={54} x2={66} y={99} h={6} color={p.beak} />
          <Eyes cx={56} cy={40} r={5} gap={9} mood={o.mood} sleeping={o.sleeping} animated={o.animated} />
          {/* big curved hookbill */}
          <path d="M44 42 Q34 42 38 52 Q40 56 46 54 Q44 48 50 46 Q48 42 44 42 Z" fill={p.beak} />
        </>
      );

    case "bigbeak":
      return (
        <>
          {wing(80, 70, 12, 22, "72px 54px")}
          <ellipse cx="62" cy="74" rx="24" ry="27" fill={p.body} />
          <ellipse cx="62" cy="80" rx="15" ry="19" fill={p.belly} />
          <circle cx="60" cy="44" r="18" fill={p.body} />
          <Legs x1={56} x2={68} y={99} h={6} color={p.beak} />
          {/* oversized bill */}
          <path d="M44 40 Q14 42 16 52 Q26 56 46 52 Z" fill={p.beak} />
          <path d="M44 40 Q14 42 16 52" stroke={p.cheek} strokeWidth="2" fill="none" opacity="0.5" />
          <Eyes cx={58} cy={42} r={5} gap={8} mood={o.mood} sleeping={o.sleeping} animated={o.animated} />
        </>
      );

    case "flamingo":
      return (
        <>
          {/* very long legs */}
          <g stroke={p.beak} strokeWidth="3" strokeLinecap="round">
            <line x1="54" y1="64" x2="50" y2="108" />
            <line x1="50" y1="108" x2="44" y2="112" />
            <line x1="66" y1="64" x2="70" y2="108" />
            <line x1="70" y1="108" x2="76" y2="112" />
          </g>
          <ellipse cx="60" cy="58" rx="22" ry="16" fill={p.body} />
          {wing(66, 56, 12, 12, "60px 52px")}
          {/* long curved neck */}
          <path d="M52 50 C40 34 44 18 58 16" stroke={p.body} strokeWidth="9" fill="none" strokeLinecap="round" />
          <circle cx="60" cy="16" r="9" fill={p.body} />
          {/* down-curved beak */}
          <path d="M66 14 Q76 16 74 24 Q72 22 68 20 Z" fill={p.beak} />
          <Eyes cx={62} cy={14} r={3} gap={4} mood={o.mood} sleeping={o.sleeping} animated={o.animated} />
        </>
      );

    case "waterbird":
      return (
        <>
          <g stroke={p.beak} strokeWidth="2.6" strokeLinecap="round">
            <line x1="55" y1="70" x2="53" y2="106" />
            <line x1="53" y1="106" x2="47" y2="110" />
            <line x1="67" y1="70" x2="69" y2="106" />
            <line x1="69" y1="106" x2="75" y2="110" />
          </g>
          <ellipse cx="60" cy="64" rx="22" ry="15" fill={p.body} />
          {wing(64, 62, 13, 12, "58px 58px")}
          <path d="M56 56 C50 40 52 26 60 22" stroke={p.body} strokeWidth="7" fill="none" strokeLinecap="round" />
          <circle cx="61" cy="22" r="8" fill={p.body} />
          {o.crest && <path d="M64 18 l10 -4 l-8 6 Z" fill={p.wing} />}
          {/* dagger beak */}
          <path d="M68 21 L86 23 L68 26 Z" fill={p.beak} />
          <Eyes cx={61} cy={21} r={3} gap={4} mood={o.mood} sleeping={o.sleeping} animated={o.animated} />
        </>
      );

    case "swan":
      return (
        <>
          {/* water line */}
          <ellipse cx="60" cy="92" rx="40" ry="6" fill={p.belly} opacity="0.4" />
          <ellipse cx="60" cy="80" rx="34" ry="18" fill={p.body} />
          {wing(72, 76, 18, 14, "60px 70px")}
          {/* S-neck */}
          <path d="M44 70 C34 56 40 36 56 36 C66 36 66 46 60 48" stroke={p.body} strokeWidth="8" fill="none" strokeLinecap="round" />
          <circle cx="58" cy="34" r="8" fill={p.body} />
          <path d="M64 32 L76 34 L64 37 Z" fill={p.beak} />
          <Eyes cx={59} cy={32} r={3} gap={4} mood={o.mood} sleeping={o.sleeping} animated={o.animated} />
        </>
      );

    case "penguin":
      return (
        <>
          <ellipse cx="60" cy="68" rx="26" ry="36" fill={p.body} />
          <ellipse cx="60" cy="72" rx="17" ry="30" fill={p.belly} />
          {/* flippers */}
          <path d="M36 56 Q26 72 36 92 L40 90 Q34 72 42 58 Z" fill={p.wing} />
          <path d="M84 56 Q94 72 84 92 L80 90 Q86 72 78 58 Z" fill={p.wing} />
          <circle cx="60" cy="40" r="19" fill={p.body} />
          {/* feet */}
          <path d="M48 102 q-6 4 -10 4 q4 4 14 2 Z" fill={p.beak} />
          <path d="M72 102 q6 4 10 4 q-4 4 -14 2 Z" fill={p.beak} />
          <Eyes cx={60} cy={40} r={4.5} gap={8} mood={o.mood} sleeping={o.sleeping} animated={o.animated} />
          {beakTri(60, 47, 4, 7)}
        </>
      );

    case "hummingbird":
      return (
        <>
          <path d="M62 64 C58 80 56 96 56 104 C62 96 70 82 70 68 Z" fill={p.wing} />
          {/* fast-flapping wings */}
          {wing(40, 56, 16, 7, "56px 56px")}
          {wing(80, 56, 16, 7, "64px 56px")}
          <ellipse cx="60" cy="58" rx="15" ry="17" fill={p.body} />
          <ellipse cx="60" cy="62" rx="9" ry="11" fill={p.belly} />
          <circle cx="60" cy="40" r="12" fill={p.body} />
          {/* needle bill */}
          <path d="M60 38 L60 14" stroke={p.beak} strokeWidth="2.4" strokeLinecap="round" />
          <Eyes cx={60} cy={40} r={3.5} gap={6} mood={o.mood} sleeping={o.sleeping} animated={o.animated} />
        </>
      );

    case "woodpecker":
      return (
        <>
          {/* stiff tail propping down */}
          <path d="M54 92 L46 116 L58 96 Z" fill={p.wing} />
          <ellipse cx="58" cy="66" rx="18" ry="30" fill={p.body} />
          <ellipse cx="62" cy="70" rx="11" ry="22" fill={p.belly} />
          {wing(48, 64, 11, 22, "56px 50px")}
          <circle cx="62" cy="36" r="15" fill={p.body} />
          {o.crest && <path d="M62 22 q3 -8 8 -6 q-2 6 -6 10 Z" fill={p.cheek} />}
          {/* chisel bill, pointing to a "trunk" */}
          <path d="M76 34 L92 36 L76 39 Z" fill={p.beak} />
          <Legs x1={56} x2={64} y={94} h={4} color={p.beak} />
          <Eyes cx={64} cy={36} r={4} gap={6} mood={o.mood} sleeping={o.sleeping} animated={o.animated} />
        </>
      );

    case "corvid":
      return (
        <>
          <path d="M64 80 C58 100 56 114 56 118 C66 108 76 92 74 82 Z" fill={p.wing} />
          {wing(78, 70, 13, 26, "70px 50px")}
          <ellipse cx="60" cy="72" rx="24" ry="28" fill={p.body} />
          <ellipse cx="60" cy="78" rx="14" ry="20" fill={p.belly} opacity="0.6" />
          <circle cx="60" cy="40" r="18" fill={p.body} />
          <Legs x1={54} x2={66} y={99} h={6} color={p.beak} />
          {/* strong straight beak */}
          <path d="M58 40 L80 42 L58 46 Z" fill={p.beak} />
          <Eyes cx={56} cy={40} r={4.5} gap={7} mood={o.mood} sleeping={o.sleeping} animated={o.animated} />
        </>
      );

    case "plump":
      return (
        <>
          {wing(78, 74, 13, 20, "70px 58px")}
          <ellipse cx="60" cy="74" rx="30" ry="28" fill={p.body} />
          <ellipse cx="60" cy="80" rx="20" ry="20" fill={p.belly} />
          <circle cx="60" cy="44" r="16" fill={p.body} />
          <Legs x1={54} x2={66} y={100} h={6} color={p.beak} />
          <Eyes cx={60} cy={44} r={4} gap={7} mood={o.mood} sleeping={o.sleeping} animated={o.animated} />
          {beakTri(60, 50, 3, 5)}
        </>
      );

    case "longtail":
      return (
        <>
          {/* sweeping long tail / partial fan */}
          <path d="M60 80 C44 104 40 118 40 120 C56 112 72 96 72 84 Z" fill={p.wing} />
          <path d="M60 80 C70 104 76 116 78 120 C70 108 70 92 70 82 Z" fill={p.cheek} opacity="0.8" />
          {wing(78, 70, 12, 20, "70px 54px")}
          <ellipse cx="60" cy="72" rx="22" ry="26" fill={p.body} />
          <ellipse cx="60" cy="78" rx="13" ry="18" fill={p.belly} />
          <circle cx="60" cy="42" r="17" fill={p.body} />
          {o.crest && <Crest x={58} y={28} color={p.wing} />}
          <Legs x1={54} x2={66} y={98} h={6} color={p.beak} />
          <Eyes cx={60} cy={42} r={4.5} gap={7} mood={o.mood} sleeping={o.sleeping} animated={o.animated} />
          {beakTri(60, 48, 3, 6)}
        </>
      );

    case "songbird":
    default:
      return (
        <>
          {o.longTail ? (
            <path d="M60 78 C40 96 30 112 26 118 C40 110 58 100 66 88 Z" fill={p.wing} />
          ) : (
            <path d="M62 80 C54 92 46 100 42 106 C54 100 64 94 70 86 Z" fill={p.wing} />
          )}
          <ellipse cx="60" cy="72" rx="30" ry="27" fill={p.body} />
          <ellipse cx="60" cy="78" rx="19" ry="19" fill={p.belly} />
          {wing(80, 70, 13, 20, "72px 58px")}
          <Legs x1={52} x2={68} y={98} h={8} color={p.beak} />
          <circle cx="60" cy="44" r="22" fill={p.body} />
          {o.crest && <Crest x={58} y={26} color={p.wing} />}
          <circle cx="49" cy="50" r={o.mood === "happy" ? 5.4 : 4.5} fill={p.cheek} opacity="0.85" />
          <circle cx="71" cy="50" r={o.mood === "happy" ? 5.4 : 4.5} fill={p.cheek} opacity="0.85" />
          <Eyes cx={60} cy={42} r={5.2} gap={8} mood={o.mood} sleeping={o.sleeping} animated={o.animated} />
          {beakTri(60, 50, 2.5, 7)}
        </>
      );
  }
}
