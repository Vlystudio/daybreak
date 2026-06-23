import type { BirdSpecies } from "@/lib/game/birds";

/**
 * An original, data-driven SVG bird. Shape is the same friendly silhouette for
 * every species; palette + crest/long-tail flags make each one distinct. CSS
 * classes (defined in globals.css) drive the idle bob, blink, and wing flap.
 */
export function BirdSprite({
  species,
  size = 120,
  animated = true,
  className,
}: {
  species: BirdSpecies;
  size?: number;
  animated?: boolean;
  className?: string;
}) {
  const p = species.palette;
  const a = animated;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label={species.name}
    >
      <g className={a ? "bird-bob" : undefined} style={{ transformOrigin: "60px 110px" }}>
        {/* tail */}
        {species.longTail ? (
          <path d="M60 78 C40 96 30 112 26 118 C40 110 58 100 66 88 Z" fill={p.wing} />
        ) : (
          <path d="M62 80 C54 92 46 100 42 106 C54 100 64 94 70 86 Z" fill={p.wing} />
        )}

        {/* body */}
        <ellipse cx="60" cy="72" rx="30" ry="27" fill={p.body} />
        {/* belly */}
        <ellipse cx="60" cy="78" rx="19" ry="19" fill={p.belly} />

        {/* wing (flaps) */}
        <ellipse
          cx="80"
          cy="70"
          rx="13"
          ry="20"
          fill={p.wing}
          className={a ? "bird-wing" : undefined}
          style={{ transformOrigin: "72px 58px" }}
        />

        {/* feet */}
        <g stroke={p.beak} strokeWidth="3" strokeLinecap="round">
          <line x1="52" y1="98" x2="52" y2="106" />
          <line x1="68" y1="98" x2="68" y2="106" />
        </g>

        {/* head */}
        <circle cx="60" cy="44" r="22" fill={p.body} />

        {/* crest */}
        {species.crest && (
          <path d="M60 22 C56 12 60 8 62 6 C62 14 66 18 70 22 C66 21 62 22 60 26 Z" fill={p.wing} />
        )}

        {/* cheeks */}
        <circle cx="49" cy="50" r="4.5" fill={p.cheek} opacity="0.85" />
        <circle cx="71" cy="50" r="4.5" fill={p.cheek} opacity="0.85" />

        {/* eyes */}
        <g className={a ? "bird-blink" : undefined} style={{ transformOrigin: "60px 42px" }}>
          <circle cx="52" cy="42" r="5.2" fill="#fff" />
          <circle cx="68" cy="42" r="5.2" fill="#fff" />
          <circle cx="53" cy="43" r="2.6" fill="#2a2320" />
          <circle cx="69" cy="43" r="2.6" fill="#2a2320" />
          <circle cx="54" cy="42" r="0.9" fill="#fff" />
          <circle cx="70" cy="42" r="0.9" fill="#fff" />
        </g>

        {/* beak */}
        <path d="M58 50 L62 50 L60 57 Z" fill={p.beak} />
      </g>
    </svg>
  );
}
