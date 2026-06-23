/**
 * Per-species bird illustration engine.
 *
 * The previous sprite reused ~14 generic bodies and just recoloured them. This
 * engine instead composes each bird from (a) a distinct silhouette TEMPLATE
 * (perched songbird vs clinging woodpecker vs floating duck vs tall wader vs
 * owl…) and (b) a stack of FIELD MARKS — caps, masks, bibs, eyebrows, wing
 * bars, breast spots, collars, barring, epaulets, etc. — each clipped to the
 * head/body so it reads like real plumage. A species is therefore pure data:
 * a template + palette + an ordered list of marks taken straight from the
 * bird's actual field marks. That gives 60 genuinely different birds in one
 * consistent cozy style.
 *
 * Output is an SVG string (no React) so the same builder powers both the
 * in-app <BirdSprite> and the exported .svg / .png asset files. Canvas is a
 * 0..100 square (the React sprite and the 512px export just scale it).
 */

import type { BirdPalette } from "@/lib/game/birds";

export type TemplateKind =
  | "perch" // generic perched songbird (round)
  | "upright" // thrush / sleeker upright passerine
  | "cling" // clinging to a trunk (woodpecker / nuthatch / creeper)
  | "flit" // wings out, flying (swallow / tern)
  | "hover" // hummingbird
  | "wader" // long legs + long neck (heron)
  | "raptor" // upright hawk / eagle / falcon / osprey
  | "owl" // round owl
  | "float" // sitting on water (duck / loon)
  | "goose" // long-necked goose / swan
  | "seabird" // standing alcid / gull (puffin, guillemot, gull, tern at rest)
  | "shorebird" // plover / woodcock — round body on legs
  | "gamebird"; // chunky ground bird (turkey / grouse)

export type BillKind =
  | "cone" // finch / sparrow seed bill
  | "thin" // warbler / wren slender bill
  | "stout" // robin / blackbird medium bill
  | "hook" // raptor hooked bill
  | "chisel" // woodpecker
  | "dagger" // heron / kingfisher / loon
  | "decurved" // creeper / thrasher down-curved
  | "huge" // puffin triangular
  | "spatula" // duck bill
  | "long"; // woodcock / shorebird very long straight

export type CrestKind = "none" | "spike" | "shag" | "sweep" | "tuft" | "horns";
export type TailKind = "short" | "medium" | "long" | "fan" | "fork" | "cock" | "point" | "updown";
export type Length = "short" | "medium" | "long";

export type Mark =
  | { m: "hood"; color: string } // whole head a different colour
  | { m: "cap"; color: string; extent?: "small" | "full" } // crown
  | { m: "mask"; color: string } // band through the eye
  | { m: "eyeline"; color: string }
  | { m: "eyebrow"; color: string }
  | { m: "eyering"; color: string }
  | { m: "forehead"; color: string }
  | { m: "cheek"; color: string }
  | { m: "throat"; color: string } // chin / throat patch
  | { m: "bib"; color: string } // black chin/upper-breast bib
  | { m: "malar"; color: string } // whisker stripe
  | { m: "collar"; color: string } // neck ring
  | { m: "nape"; color: string } // back-of-head patch
  | { m: "crownStripe"; color: string } // lateral head stripes
  | { m: "facelines"; color: string } // wood-duck / pileated face stripes
  | { m: "breastBand"; color: string; count?: 1 | 2 }
  | { m: "breastWash"; color: string } // soft coloured breast
  | { m: "breastSpot"; color: string }
  | { m: "breastTriangle"; color: string }
  | { m: "streaks"; color: string } // streaked breast/flanks
  | { m: "scaly"; color: string } // spangled/scalloped body
  | { m: "wingbars"; color: string; count?: 1 | 2 }
  | { m: "wingPatch"; color: string }
  | { m: "epaulet"; color: string; edge?: string } // shoulder patch (red-winged)
  | { m: "ladderback"; color: string } // black/white woodpecker bars
  | { m: "barback"; color: string } // zebra/barred back
  | { m: "checker"; color: string } // loon checkerboard
  | { m: "spots"; color: string } // wing/back spotting
  | { m: "wingtips"; color: string } // dark primaries
  | { m: "tailband"; color: string }
  | { m: "tailtip"; color: string }
  | { m: "undertail"; color: string }
  | { m: "billspot"; color: string }; // gull red gonys spot

export interface BirdArt {
  template: TemplateKind;
  bill: BillKind;
  crest?: CrestKind;
  tail?: TailKind;
  legs?: Length;
  marks?: Mark[];
}

export interface RenderOpts {
  uid: string;
  mood?: "happy" | "content" | "sleepy";
  sleeping?: boolean;
  animated?: boolean;
}

/* ── small SVG helpers ─────────────────────────────────────────────────── */
const n = (v: number) => Math.round(v * 100) / 100;
const ell = (cx: number, cy: number, rx: number, ry: number, fill: string, extra = "") =>
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}"${extra ? " " + extra : ""}/>`;
const circ = (cx: number, cy: number, r: number, fill: string, extra = "") =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}"${extra ? " " + extra : ""}/>`;
const path = (d: string, fill: string, extra = "") => `<path d="${d}" fill="${fill}"${extra ? " " + extra : ""}/>`;
const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, w: number, extra = "") =>
  `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"${extra ? " " + extra : ""}/>`;
const rect = (x: number, y: number, w: number, h: number, fill: string, extra = "") =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"${extra ? " " + extra : ""}/>`;

/** Anchors a template exposes so marks can be drawn without raw coordinates. */
interface Anchor {
  headCx: number;
  headCy: number;
  headR: number;
  faceDir: 1 | -1;
  eyeCx: number;
  eyeCy: number;
  eyeR: number;
  billX: number;
  billY: number;
  bodyCx: number;
  bodyCy: number;
  bodyRx: number;
  bodyRy: number;
  wingCx: number;
  wingCy: number;
  wingRx: number;
  wingRy: number;
  breastX: number;
  breastY: number;
  tailX: number;
  tailY: number;
}

interface Built {
  behind: string; // legs, tail, far wing — drawn first
  body: string; // body + belly + wing + head fills
  anchor: Anchor;
}

/* ── legs ──────────────────────────────────────────────────────────────── */
function legs(cx: number, topY: number, len: number, color: string, spread = 5) {
  const foot = (x: number) =>
    line(x, topY + len, x - 2.4, topY + len + 1.6, color, 1.4) +
    line(x, topY + len, x, topY + len + 1.8, color, 1.4) +
    line(x, topY + len, x + 2.4, topY + len + 1.6, color, 1.4);
  return (
    `<g>` +
    line(cx - spread, topY, cx - spread, topY + len, color, 2) +
    line(cx + spread, topY, cx + spread, topY + len, color, 2) +
    foot(cx - spread) +
    foot(cx + spread) +
    `</g>`
  );
}

/* ── tails (drawn behind body, sweeping back-left for a right-facing bird) ── */
function tailShape(kind: TailKind, a: { x: number; y: number; color: string; wing: string }) {
  const { x, y, color, wing } = a;
  switch (kind) {
    case "long":
      return path(`M${x} ${y} C${x - 16} ${y + 10} ${x - 26} ${y + 22} ${x - 30} ${y + 30} L${x - 22} ${y + 30} C${x - 16} ${y + 18} ${x - 6} ${y + 8} ${x + 2} ${y + 4} Z`, color);
    case "point":
      return path(`M${x} ${y} C${x - 12} ${y + 10} ${x - 20} ${y + 22} ${x - 24} ${y + 32} L${x - 16} ${y + 26} C${x - 10} ${y + 16} ${x - 2} ${y + 8} ${x + 3} ${y + 5} Z`, color);
    case "fork":
      return (
        path(`M${x} ${y} L${x - 22} ${y + 18} L${x - 16} ${y + 12} L${x - 10} ${y + 16} L${x - 6} ${y + 8} Z`, color) +
        path(`M${x} ${y + 2} L${x - 24} ${y + 26} L${x - 15} ${y + 18} L${x - 8} ${y + 10} Z`, wing)
      );
    case "cock": // wren — short tail flicked up
      return path(`M${x + 2} ${y} C${x - 4} ${y - 10} ${x - 6} ${y - 18} ${x - 4} ${y - 22} L${x + 4} ${y - 18} C${x + 6} ${y - 10} ${x + 7} ${y - 4} ${x + 6} ${y + 2} Z`, color);
    case "updown":
      return path(`M${x} ${y} C${x - 6} ${y - 8} ${x - 8} ${y - 16} ${x - 6} ${y - 20} L${x + 2} ${y - 16} C${x + 3} ${y - 8} ${x + 3} ${y - 2} ${x + 2} ${y + 2} Z`, color);
    case "fan":
      return path(`M${x} ${y} C${x - 18} ${y + 4} ${x - 26} ${y + 14} ${x - 28} ${y + 26} C${x - 18} ${y + 22} ${x - 4} ${y + 18} ${x + 4} ${y + 12} Z`, color);
    case "short":
      return path(`M${x} ${y} C${x - 8} ${y + 4} ${x - 12} ${y + 9} ${x - 13} ${y + 14} L${x - 5} ${y + 12} C${x - 1} ${y + 8} ${x + 2} ${y + 5} ${x + 4} ${y + 3} Z`, color);
    case "medium":
    default:
      return path(`M${x} ${y} C${x - 12} ${y + 6} ${x - 18} ${y + 14} ${x - 20} ${y + 22} L${x - 11} ${y + 19} C${x - 6} ${y + 12} ${x - 1} ${y + 7} ${x + 3} ${y + 4} Z`, color);
  }
}

/* ── bills ─────────────────────────────────────────────────────────────── */
function billShape(kind: BillKind, x: number, y: number, dir: number, color: string, darken: string) {
  const d = dir;
  switch (kind) {
    case "cone":
      return path(`M${x} ${y - 2.4} L${x + d * 7} ${y} L${x} ${y + 2.4} Z`, color);
    case "thin":
      return path(`M${x} ${y - 1.3} L${x + d * 8} ${y} L${x} ${y + 1.3} Z`, color);
    case "stout":
      return path(`M${x} ${y - 1.8} L${x + d * 6} ${y + 0.4} L${x} ${y + 2.2} Z`, color);
    case "hook":
      return path(`M${x - d * 1} ${y - 2.6} L${x + d * 7} ${y - 1} Q${x + d * 9} ${y + 1.4} ${x + d * 5.5} ${y + 3.2} Q${x + d * 5} ${y + 1} ${x} ${y + 1.6} Z`, color);
    case "chisel":
      return path(`M${x} ${y - 1.6} L${x + d * 11} ${y - 0.2} L${x + d * 11} ${y + 1} L${x} ${y + 2.2} Z`, color);
    case "dagger":
      return path(`M${x} ${y - 1.8} L${x + d * 15} ${y} L${x} ${y + 2} Z`, color) + line(x, y, x + d * 15, y, darken, 0.5);
    case "decurved":
      return path(`M${x} ${y - 1.6} Q${x + d * 8} ${y - 1} ${x + d * 11} ${y + 4} Q${x + d * 6} ${y + 1.4} ${x} ${y + 1.8} Z`, color);
    case "long":
      return path(`M${x} ${y - 1.4} L${x + d * 20} ${y + 1.2} L${x + d * 19.5} ${y + 2} L${x} ${y + 1.8} Z`, color);
    case "huge": // puffin triangular bill (re-coloured by the species via marks too)
      return (
        path(`M${x - d * 4} ${y - 5} Q${x + d * 11} ${y - 3} ${x + d * 11} ${y + 4} Q${x + d * 6} ${y + 7} ${x - d * 3} ${y + 4} Z`, color) +
        line(x - d * 1, y - 3.5, x - d * 1, y + 4, darken, 0.7) +
        line(x + d * 4, y - 3.6, x + d * 4, y + 5, darken, 0.6)
      );
    case "spatula": // duck bill
      return (
        path(`M${x - d * 2} ${y - 2.6} Q${x + d * 11} ${y - 3} ${x + d * 12.5} ${y + 0.5} Q${x + d * 11} ${y + 3.4} ${x - d * 2} ${y + 2.8} Z`, color) +
        circ(x + d * 11.5, y + 0.4, 0.9, darken)
      );
    default:
      return path(`M${x} ${y - 2} L${x + d * 7} ${y} L${x} ${y + 2} Z`, color);
  }
}

/* ── crests ────────────────────────────────────────────────────────────── */
function crestShape(kind: CrestKind, a: Anchor, color: string) {
  const x = a.headCx;
  const top = a.headCy - a.headR;
  const d = a.faceDir;
  switch (kind) {
    case "spike": // cardinal / jay pointed crest
      return path(`M${x - 3} ${top + 3} L${x + d * 2} ${top - 12} L${x + d * 5} ${top + 1} Z`, color);
    case "sweep": // waxwing / titmouse swept back
      return path(`M${x - d * 5} ${top + 2} Q${x - d * 12} ${top - 8} ${x - d * 6} ${top - 9} Q${x - d * 1} ${top - 6} ${x + 2} ${top + 2} Z`, color);
    case "shag": // kingfisher / jay shaggy double
      return (
        path(`M${x - 5} ${top + 3} L${x - 2} ${top - 8} L${x + 1} ${top + 1} Z`, color) +
        path(`M${x + 1} ${top + 2} L${x + d * 4} ${top - 9} L${x + d * 6} ${top + 1} Z`, color)
      );
    case "tuft": // soft cockatiel-ish single tuft
      return path(`M${x} ${top + 2} Q${x + d * 2} ${top - 11} ${x + d * 6} ${top - 9} Q${x + d * 4} ${top - 3} ${x + 3} ${top + 2} Z`, color);
    case "horns": // owl ear tufts
      return (
        path(`M${x - a.headR * 0.55} ${top + 4} l-2 -8 l5 4 Z`, color) +
        path(`M${x + a.headR * 0.55} ${top + 4} l2 -8 l-5 4 Z`, color)
      );
    default:
      return "";
  }
}

/* ── eyes ──────────────────────────────────────────────────────────────── */
function eyes(a: Anchor, o: RenderOpts) {
  const dark = "#241f1c";
  const { eyeCx, eyeCy, eyeR } = a;
  if (o.sleeping || o.mood === "sleepy") {
    return `<g stroke="${dark}" stroke-width="1.4" stroke-linecap="round" fill="none"><path d="M${n(eyeCx - eyeR - 0.5)} ${n(eyeCy)} Q${n(eyeCx)} ${n(eyeCy + eyeR)} ${n(eyeCx + eyeR + 0.5)} ${n(eyeCy)}"/></g>`;
  }
  const dy = o.mood === "happy" ? -0.4 : 0;
  const blink = o.animated ? ` class="bird-blink" style="transform-origin:${n(eyeCx)}px ${n(eyeCy)}px"` : "";
  return (
    `<g${blink}>` +
    circ(eyeCx, eyeCy, eyeR, "#fff") +
    circ(eyeCx + a.faceDir * 0.3, eyeCy + dy, eyeR * 0.62, dark) +
    circ(eyeCx + a.faceDir * 0.7, eyeCy - 0.5 + dy, eyeR * 0.22, "#fff") +
    `</g>`
  );
}

/* ── templates ─────────────────────────────────────────────────────────── */
type TemplateFn = (p: BirdPalette, art: BirdArt) => Built;

const TEMPLATES: Record<TemplateKind, TemplateFn> = {
  perch: (p, art) => {
    const A: Anchor = {
      headCx: 50, headCy: 35, headR: 15, faceDir: 1,
      eyeCx: 56, eyeCy: 33, eyeR: 3,
      billX: 64, billY: 37,
      bodyCx: 49, bodyCy: 60, bodyRx: 22, bodyRy: 24,
      wingCx: 44, wingCy: 60, wingRx: 13, wingRy: 19,
      breastX: 54, breastY: 58, tailX: 31, tailY: 64,
    };
    const legLen = art.legs === "long" ? 16 : art.legs === "short" ? 6 : 10;
    return {
      behind:
        tailShape(art.tail ?? "medium", { x: A.tailX, y: A.tailY, color: p.wing, wing: p.body }) +
        legs(50, 82, legLen, p.beak),
      body:
        ell(A.bodyCx, A.bodyCy, A.bodyRx, A.bodyRy, p.body) +
        ell(54, 64, 15, 18, p.belly) +
        ell(A.wingCx, A.wingCy, A.wingRx, A.wingRy, p.wing) +
        circ(A.headCx, A.headCy, A.headR, p.body),
      anchor: A,
    };
  },

  upright: (p, art) => {
    const A: Anchor = {
      headCx: 52, headCy: 30, headR: 13, faceDir: 1,
      eyeCx: 57, eyeCy: 28, eyeR: 2.8,
      billX: 64, billY: 31,
      bodyCx: 49, bodyCy: 58, bodyRx: 19, bodyRy: 26,
      wingCx: 43, wingCy: 58, wingRx: 12, wingRy: 21,
      breastX: 55, breastY: 54, tailX: 33, tailY: 70,
    };
    const legLen = art.legs === "long" ? 17 : art.legs === "short" ? 8 : 13;
    return {
      behind:
        tailShape(art.tail ?? "medium", { x: A.tailX, y: A.tailY, color: p.wing, wing: p.body }) +
        legs(51, 80, legLen, p.beak, 4.5),
      body:
        ell(A.bodyCx, A.bodyCy, A.bodyRx, A.bodyRy, p.body) +
        ell(55, 60, 12, 21, p.belly) +
        ell(A.wingCx, A.wingCy, A.wingRx, A.wingRy, p.wing) +
        circ(A.headCx, A.headCy, A.headR, p.body),
      anchor: A,
    };
  },

  cling: (p) => {
    // Vertical posture against an implied trunk on the left.
    const A: Anchor = {
      headCx: 44, headCy: 30, headR: 12, faceDir: 1,
      eyeCx: 48, eyeCy: 28, eyeR: 2.6,
      billX: 55, billY: 31,
      bodyCx: 44, bodyCy: 58, bodyRx: 16, bodyRy: 28,
      wingCx: 40, wingCy: 56, wingRx: 11, wingRy: 24,
      breastX: 50, breastY: 56, tailX: 40, tailY: 84,
    };
    return {
      behind:
        // stiff propping tail pointing straight down
        path(`M${A.tailX - 4} ${A.tailY} L${A.tailX - 1} ${A.tailY + 16} L${A.tailX + 5} ${A.tailY + 15} L${A.tailX + 6} ${A.tailY} Z`, p.wing) +
        line(30, 38, 30, 78, p.beak, 1) + // foot grips
        line(30, 50, 36, 46, p.beak, 1.4),
      body:
        ell(A.bodyCx, A.bodyCy, A.bodyRx, A.bodyRy, p.body) +
        ell(50, 60, 9, 22, p.belly) +
        ell(A.wingCx, A.wingCy, A.wingRx, A.wingRy, p.wing) +
        circ(A.headCx, A.headCy, A.headR, p.body),
      anchor: A,
    };
  },

  flit: (p, art) => {
    const A: Anchor = {
      headCx: 56, headCy: 40, headR: 11, faceDir: 1,
      eyeCx: 60, eyeCy: 38, eyeR: 2.4,
      billX: 66, billY: 41,
      bodyCx: 50, bodyCy: 52, bodyRx: 18, bodyRy: 13,
      wingCx: 40, wingCy: 44, wingRx: 22, wingRy: 8,
      breastX: 56, breastY: 52, tailX: 33, tailY: 56,
    };
    return {
      behind:
        tailShape(art.tail ?? "fork", { x: A.tailX, y: A.tailY, color: p.wing, wing: p.body }) +
        // far swept wing
        path(`M48 50 Q22 36 8 44 Q26 48 46 56 Z`, p.wing),
      body:
        ell(A.bodyCx, A.bodyCy, A.bodyRx, A.bodyRy, p.body) +
        ell(52, 54, 13, 9, p.belly) +
        circ(A.headCx, A.headCy, A.headR, p.body) +
        // near swept wing (over body)
        path(`M52 48 Q78 34 94 42 Q74 50 54 56 Z`, p.wing),
      anchor: A,
    };
  },

  hover: (p) => {
    const A: Anchor = {
      headCx: 52, headCy: 42, headR: 10, faceDir: 1,
      eyeCx: 56, eyeCy: 40, eyeR: 2.2,
      billX: 61, billY: 43,
      bodyCx: 49, bodyCy: 56, bodyRx: 12, bodyRy: 14,
      wingCx: 40, wingCy: 52, wingRx: 16, wingRy: 6,
      breastX: 53, breastY: 56, tailX: 40, tailY: 66,
    };
    return {
      behind:
        path(`M44 64 L36 80 L48 70 Z`, p.wing) +
        // blurred wings
        ell(34, 50, 17, 6, p.wing, 'opacity="0.5"') +
        ell(66, 50, 17, 6, p.wing, 'opacity="0.5"'),
      body:
        ell(A.bodyCx, A.bodyCy, A.bodyRx, A.bodyRy, p.body) +
        ell(51, 58, 7, 9, p.belly) +
        circ(A.headCx, A.headCy, A.headR, p.body),
      anchor: A,
    };
  },

  wader: (p, art) => {
    const A: Anchor = {
      headCx: 60, headCy: 22, headR: 9, faceDir: 1,
      eyeCx: 63, eyeCy: 20, eyeR: 2,
      billX: 69, billY: 23,
      bodyCx: 48, bodyCy: 58, bodyRx: 20, bodyRy: 15,
      wingCx: 46, wingCy: 58, wingRx: 16, wingRy: 13,
      breastX: 58, breastY: 50, tailX: 28, tailY: 60,
    };
    const legLen = art.legs === "short" ? 16 : 30;
    return {
      behind:
        // long legs
        line(46, 70, 44, 70 + legLen, p.beak, 1.8) +
        line(44, 70 + legLen, 40, 72 + legLen, p.beak, 1.6) +
        line(54, 70, 56, 70 + legLen, p.beak, 1.8) +
        line(56, 70 + legLen, 60, 72 + legLen, p.beak, 1.6) +
        // tail
        path(`M30 58 L18 64 L30 64 Z`, p.wing),
      body:
        ell(A.bodyCx, A.bodyCy, A.bodyRx, A.bodyRy, p.body) +
        ell(50, 60, 14, 11, p.belly) +
        ell(A.wingCx, A.wingCy, A.wingRx, A.wingRy, p.wing) +
        // long neck
        path(`M52 50 C50 38 54 28 60 26`, "none", `stroke="${p.body}" stroke-width="7" stroke-linecap="round"`) +
        circ(A.headCx, A.headCy, A.headR, p.body),
      anchor: A,
    };
  },

  raptor: (p) => {
    const A: Anchor = {
      headCx: 52, headCy: 28, headR: 14, faceDir: 1,
      eyeCx: 58, eyeCy: 26, eyeR: 3,
      billX: 65, billY: 31,
      bodyCx: 49, bodyCy: 58, bodyRx: 20, bodyRy: 27,
      wingCx: 42, wingCy: 56, wingRx: 13, wingRy: 23,
      breastX: 55, breastY: 52, tailX: 33, tailY: 74,
    };
    return {
      behind:
        path(`M${A.tailX} ${A.tailY} L${A.tailX - 6} ${A.tailY + 16} L${A.tailX + 10} ${A.tailY + 15} L${A.tailX + 6} ${A.tailY} Z`, p.wing) +
        // talons
        legs(50, 82, 7, p.beak, 5),
      body:
        ell(A.bodyCx, A.bodyCy, A.bodyRx, A.bodyRy, p.body) +
        ell(55, 60, 12, 22, p.belly) +
        ell(A.wingCx, A.wingCy, A.wingRx, A.wingRy, p.wing) +
        circ(A.headCx, A.headCy, A.headR, p.body) +
        // brow ridge for a fierce look
        path(`M${A.headCx - 12} ${A.headCy - 4} Q${A.headCx} ${A.headCy - 12} ${A.headCx + 13} ${A.headCy - 3}`, "none", `stroke="${p.wing}" stroke-width="3" stroke-linecap="round"`),
      anchor: A,
    };
  },

  owl: (p) => {
    const A: Anchor = {
      headCx: 50, headCy: 36, headR: 24, faceDir: 1,
      eyeCx: 50, eyeCy: 36, eyeR: 6.5, // owls get two forward eyes (handled below)
      billX: 50, billY: 42,
      bodyCx: 50, bodyCy: 66, bodyRx: 26, bodyRy: 28,
      wingCx: 28, wingCy: 66, wingRx: 9, wingRy: 22,
      breastX: 50, breastY: 60, tailX: 50, tailY: 92,
    };
    return {
      behind: legs(50, 90, 5, p.beak, 7),
      body:
        ell(A.bodyCx, A.bodyCy, A.bodyRx, A.bodyRy, p.body) +
        ell(50, 70, 17, 22, p.belly) +
        ell(28, 66, 9, 22, p.wing) +
        ell(72, 66, 9, 22, p.wing) +
        circ(A.headCx, A.headCy, A.headR, p.body) +
        // facial disc
        ell(42, 38, 11, 13, p.belly, 'opacity="0.55"') +
        ell(58, 38, 11, 13, p.belly, 'opacity="0.55"'),
      anchor: A,
    };
  },

  float: (p) => {
    const A: Anchor = {
      headCx: 64, headCy: 34, headR: 12, faceDir: 1,
      eyeCx: 68, eyeCy: 32, eyeR: 2.4,
      billX: 75, billY: 36,
      bodyCx: 46, bodyCy: 60, bodyRx: 30, bodyRy: 16,
      wingCx: 42, wingCy: 58, wingRx: 20, wingRy: 12,
      breastX: 60, breastY: 54, tailX: 16, tailY: 56,
    };
    return {
      behind:
        // water line
        ell(50, 72, 40, 5, p.belly, 'opacity="0.35"') +
        path(`M20 58 L6 54 L18 62 Z`, p.wing),
      body:
        ell(A.bodyCx, A.bodyCy, A.bodyRx, A.bodyRy, p.body) +
        ell(A.wingCx, A.wingCy, A.wingRx, A.wingRy, p.wing) +
        // neck
        path(`M58 48 C58 40 60 34 64 32`, "none", `stroke="${p.body}" stroke-width="9" stroke-linecap="round"`) +
        circ(A.headCx, A.headCy, A.headR, p.body),
      anchor: A,
    };
  },

  goose: (p) => {
    const A: Anchor = {
      headCx: 70, headCy: 22, headR: 10, faceDir: 1,
      eyeCx: 73, eyeCy: 20, eyeR: 2.2,
      billX: 79, billY: 23,
      bodyCx: 44, bodyCy: 60, bodyRx: 30, bodyRy: 18,
      wingCx: 40, wingCy: 58, wingRx: 21, wingRy: 14,
      breastX: 60, breastY: 50, tailX: 14, tailY: 56,
    };
    return {
      behind:
        ell(48, 74, 38, 5, p.belly, 'opacity="0.3"') +
        path(`M16 58 L4 56 L16 63 Z`, p.wing),
      body:
        ell(A.bodyCx, A.bodyCy, A.bodyRx, A.bodyRy, p.body) +
        ell(A.wingCx, A.wingCy, A.wingRx, A.wingRy, p.wing) +
        // long S-neck
        path(`M58 50 C56 36 62 24 70 24`, "none", `stroke="${p.body}" stroke-width="8" stroke-linecap="round"`) +
        circ(A.headCx, A.headCy, A.headR, p.body),
      anchor: A,
    };
  },

  seabird: (p, art) => {
    const A: Anchor = {
      headCx: 50, headCy: 28, headR: 14, faceDir: 1,
      eyeCx: 55, eyeCy: 26, eyeR: 2.6,
      billX: 63, billY: 31,
      bodyCx: 49, bodyCy: 60, bodyRx: 19, bodyRy: 26,
      wingCx: 43, wingCy: 60, wingRx: 12, wingRy: 22,
      breastX: 55, breastY: 56, tailX: 33, tailY: 80,
    };
    const legLen = art.legs === "long" ? 12 : 8;
    return {
      behind:
        path(`M${A.tailX} ${A.tailY} L${A.tailX - 6} ${A.tailY + 8} L${A.tailX + 8} ${A.tailY + 8} Z`, p.wing) +
        legs(50, 83, legLen, p.beak, 5),
      body:
        ell(A.bodyCx, A.bodyCy, A.bodyRx, A.bodyRy, p.body) +
        ell(53, 64, 13, 20, p.belly) +
        ell(A.wingCx, A.wingCy, A.wingRx, A.wingRy, p.wing) +
        circ(A.headCx, A.headCy, A.headR, p.body),
      anchor: A,
    };
  },

  shorebird: (p, art) => {
    const A: Anchor = {
      headCx: 54, headCy: 34, headR: 13, faceDir: 1,
      eyeCx: 59, eyeCy: 31, eyeR: 2.6,
      billX: 66, billY: 36,
      bodyCx: 47, bodyCy: 56, bodyRx: 22, bodyRy: 18,
      wingCx: 42, wingCy: 56, wingRx: 16, wingRy: 15,
      breastX: 56, breastY: 50, tailX: 27, tailY: 60,
    };
    const legLen = art.legs === "long" ? 22 : art.legs === "short" ? 9 : 15;
    return {
      behind:
        line(46, 70, 45, 70 + legLen, p.beak, 1.6) +
        line(45, 70 + legLen, 41, 71 + legLen, p.beak, 1.4) +
        line(54, 70, 55, 70 + legLen, p.beak, 1.6) +
        line(55, 70 + legLen, 59, 71 + legLen, p.beak, 1.4) +
        path(`M28 56 L18 60 L28 61 Z`, p.wing),
      body:
        ell(A.bodyCx, A.bodyCy, A.bodyRx, A.bodyRy, p.body) +
        ell(52, 59, 14, 13, p.belly) +
        ell(A.wingCx, A.wingCy, A.wingRx, A.wingRy, p.wing) +
        circ(A.headCx, A.headCy, A.headR, p.body),
      anchor: A,
    };
  },

  gamebird: (p, art) => {
    const A: Anchor = {
      headCx: 64, headCy: 30, headR: 10, faceDir: 1,
      eyeCx: 67, eyeCy: 28, eyeR: 2.2,
      billX: 73, billY: 31,
      bodyCx: 44, bodyCy: 60, bodyRx: 26, bodyRy: 21,
      wingCx: 42, wingCy: 60, wingRx: 18, wingRy: 17,
      breastX: 58, breastY: 52, tailX: 20, tailY: 56,
    };
    const legLen = art.legs === "long" ? 16 : 11;
    return {
      behind:
        // big fanned / raised tail behind
        (art.tail === "fan"
          ? path(`M24 60 C6 52 0 30 6 18 C16 30 26 44 32 56 Z`, p.wing) + path(`M24 60 C12 46 10 28 16 18 C22 32 30 46 32 56 Z`, p.body, 'opacity="0.7"')
          : path(`M22 58 C10 52 6 40 10 32 C18 42 28 50 32 56 Z`, p.wing)) +
        line(48, 78, 46, 78 + legLen, p.beak, 2) +
        line(58, 78, 60, 78 + legLen, p.beak, 2),
      body:
        ell(A.bodyCx, A.bodyCy, A.bodyRx, A.bodyRy, p.body) +
        ell(52, 64, 16, 15, p.belly) +
        ell(A.wingCx, A.wingCy, A.wingRx, A.wingRy, p.wing) +
        // neck + small head
        path(`M58 50 C58 42 60 34 64 32`, "none", `stroke="${p.body}" stroke-width="8" stroke-linecap="round"`) +
        circ(A.headCx, A.headCy, A.headR, p.body),
      anchor: A,
    };
  },
};

/* ── marks ─────────────────────────────────────────────────────────────── */
function renderMark(mk: Mark, a: Anchor, uid: string): string {
  const hc = `clip-path="url(#h${uid})"`;
  const bc = `clip-path="url(#b${uid})"`;
  const wc = `clip-path="url(#w${uid})"`;
  const { headCx: hx, headCy: hy, headR: hr, eyeCx: ex, eyeCy: ey, faceDir: d } = a;

  switch (mk.m) {
    case "hood":
      return circ(hx, hy, hr + 0.3, mk.color) + ell(a.breastX - 2, hy + hr - 1, 6, 5, mk.color, bc);
    case "cap":
      return rect(hx - hr - 1, hy - hr - 1, (hr + 1) * 2, hr + (mk.extent === "full" ? hr * 0.9 : hr * 0.5), mk.color, hc);
    case "forehead":
      return rect(hx - hr - 1, hy - hr - 1, (hr + 1) * 2, hr * 0.5, mk.color, hc);
    case "mask":
      return rect(hx - hr - 1, ey - 3, (hr + 1) * 2, 6.5, mk.color, hc);
    case "eyeline":
      return rect(hx - 2, ey - 1.4, hr + 6, 2.8, mk.color, hc);
    case "eyebrow":
      return rect(hx - hr, ey - 5, (hr + 4), 2.4, mk.color, hc);
    case "eyering":
      return circ(ex, ey, a.eyeR + 1.8, "none", `stroke="${mk.color}" stroke-width="1.4" ${hc}`);
    case "cheek":
      return ell(hx + d * 3, ey + 3, 7, 6, mk.color, hc);
    case "throat":
      return ell(hx + d * 4, hy + hr - 2, 6, 5, mk.color, hc);
    case "bib":
      return ell(hx + d * 4, hy + hr - 1, 6.5, 7, mk.color, hc) + ell(a.breastX, a.breastY - 2, 7, 6, mk.color, bc);
    case "malar":
      return rect(hx + d * 1, ey + 3, hr, 2.2, mk.color, hc);
    case "collar":
      return ell(a.breastX - 4, hy + hr, 9, 3.2, mk.color, bc);
    case "nape":
      return circ(hx - d * (hr - 4), hy - 2, 4, mk.color, hc);
    case "crownStripe":
      return (
        rect(hx - hr - 1, hy - hr - 1, (hr + 1) * 2, 2.6, mk.color, hc) +
        rect(hx - hr - 1, hy - hr + 5, (hr + 1) * 2, 2.4, mk.color, hc)
      );
    case "facelines":
      return (
        rect(hx - hr, ey - 4, hr * 2, 1.6, "#fff", hc) +
        rect(hx - hr, ey + 2, hr * 2, 1.6, "#fff", hc)
      );
    case "breastBand":
      return (
        ell(a.breastX - 2, a.breastY + 1, 13, 2.6, mk.color, bc) +
        (mk.count === 2 ? ell(a.breastX - 2, a.breastY + 7, 13, 2.4, mk.color, bc) : "")
      );
    case "breastWash":
      return ell(a.breastX, a.breastY + 2, 12, 11, mk.color, bc);
    case "breastSpot":
      return circ(a.breastX, a.breastY + 4, 3.4, mk.color, bc);
    case "breastTriangle":
      return path(`M${a.breastX - 8} ${a.breastY - 4} L${a.breastX + 7} ${a.breastY - 4} L${a.breastX - 1} ${a.breastY + 9} Z`, mk.color, bc);
    case "streaks":
      return [0, 1, 2, 3].map((i) => rect(a.breastX - 8 + i * 4.6, a.breastY - 5, 1.4, 16, mk.color, bc)).join("");
    case "scaly":
      return [0, 1, 2, 3, 4].map((i) => circ(a.bodyCx - 10 + (i % 3) * 10, a.bodyCy - 6 + Math.floor(i / 3) * 9, 2, mk.color, bc)).join("");
    case "wingbars":
      return (
        rect(a.wingCx - a.wingRx, a.wingCy + 2, a.wingRx * 2, 1.8, mk.color, wc) +
        (mk.count === 2 ? rect(a.wingCx - a.wingRx, a.wingCy + 8, a.wingRx * 2, 1.8, mk.color, wc) : "")
      );
    case "wingPatch":
      return ell(a.wingCx, a.wingCy + 4, a.wingRx * 0.7, a.wingRy * 0.45, mk.color, wc);
    case "epaulet":
      return (
        ell(a.wingCx + 1, a.wingCy - a.wingRy * 0.4, 6, 4, mk.color, wc) +
        (mk.edge ? ell(a.wingCx + 1, a.wingCy - a.wingRy * 0.4 + 4, 6, 1.6, mk.edge, wc) : "")
      );
    case "ladderback":
      return [0, 1, 2, 3, 4, 5].map((i) => rect(a.wingCx - a.wingRx, a.wingCy - a.wingRy + i * 7, a.wingRx * 2, 2.4, mk.color, wc)).join("");
    case "barback":
      return [0, 1, 2, 3, 4, 5, 6].map((i) => rect(a.bodyCx - a.bodyRx, a.bodyCy - a.bodyRy + i * 6.5, a.bodyRx * 2, 2.2, mk.color, bc)).join("");
    case "checker":
      return [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => rect(a.bodyCx - 14 + (i % 3) * 10, a.bodyCy - 12 + Math.floor(i / 3) * 9, 4.5, 4.5, mk.color, bc)).join("");
    case "spots":
      return [0, 1, 2, 3, 4, 5].map((i) => circ(a.bodyCx - 12 + (i % 3) * 11, a.bodyCy - 4 + Math.floor(i / 3) * 10, 1.8, mk.color, bc)).join("");
    case "wingtips":
      return path(`M${a.tailX + 2} ${a.bodyCy + a.bodyRy - 8} q-10 4 -14 12 l8 -2 q4 -6 10 -6 Z`, mk.color, bc);
    case "tailband":
      return rect(a.tailX - 8, a.tailY + 10, 16, 3, mk.color);
    case "tailtip":
      return rect(a.tailX - 8, a.tailY + 14, 14, 2.6, mk.color);
    case "undertail":
      return ell(a.tailX + 4, a.tailY + 6, 5, 4, mk.color);
    case "billspot":
      return circ(a.billX + d * 6, a.billY + 1.5, 1.1, mk.color);
    default:
      return "";
  }
}

/* ── builder ───────────────────────────────────────────────────────────── */
export function renderBirdArt(p: BirdPalette, art: BirdArt, o: RenderOpts): string {
  const built = TEMPLATES[art.template](p, art);
  const a = built.anchor;
  const u = o.uid;

  const defs =
    `<defs>` +
    `<clipPath id="h${u}"><circle cx="${n(a.headCx)}" cy="${n(a.headCy)}" r="${n(a.headR)}"/></clipPath>` +
    `<clipPath id="b${u}"><ellipse cx="${n(a.bodyCx)}" cy="${n(a.bodyCy)}" rx="${n(a.bodyRx)}" ry="${n(a.bodyRy)}"/><ellipse cx="${n(a.breastX)}" cy="${n(a.breastY)}" rx="14" ry="16"/></clipPath>` +
    `<clipPath id="w${u}"><ellipse cx="${n(a.wingCx)}" cy="${n(a.wingCy)}" rx="${n(a.wingRx)}" ry="${n(a.wingRy)}"/></clipPath>` +
    `</defs>`;

  const marks = (art.marks ?? []).map((mk) => renderMark(mk, a, u)).join("");
  const crest = art.crest && art.crest !== "none" ? crestShape(art.crest, a, art.crest === "horns" ? p.wing : p.cheek) : "";
  const bill = billShape(art.bill, a.billX, a.billY, a.faceDir, p.beak, p.wing);

  // Owls look forward with two big eyes; everyone else gets one side eye.
  const eyeLayer =
    art.template === "owl"
      ? owlEyes(a, o)
      : eyes(a, o);

  return defs + built.behind + built.body + marks + crest + bill + eyeLayer;
}

function owlEyes(a: Anchor, o: RenderOpts) {
  const dark = "#241f1c";
  const lx = a.headCx - 8;
  const rx = a.headCx + 8;
  const r = 6.5;
  if (o.sleeping || o.mood === "sleepy") {
    return `<g stroke="${dark}" stroke-width="1.6" stroke-linecap="round" fill="none"><path d="M${lx - 4} ${a.headCy} Q${lx} ${a.headCy + 4} ${lx + 4} ${a.headCy}"/><path d="M${rx - 4} ${a.headCy} Q${rx} ${a.headCy + 4} ${rx + 4} ${a.headCy}"/></g>`;
  }
  const big = (cx: number) =>
    circ(cx, a.headCy, r, "#fdf6e6") + circ(cx, a.headCy, r * 0.6, "#3a2f23") + circ(cx + 1, a.headCy - 1, r * 0.2, "#fff");
  return big(lx) + big(rx);
}

/** A full standalone 512×512 SVG document for the exported asset files. */
export function birdArtDocument(opts: { name: string; slug: string; marks: string; palette: BirdPalette; art: BirdArt }): string {
  const inner = renderBirdArt(opts.palette, opts.art, { uid: opts.slug.replace(/[^a-z0-9]/gi, "") });
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!-- ${opts.name} — ${opts.marks} -->\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100" role="img" aria-label="${opts.name}">\n` +
    `  ${inner}\n` +
    `</svg>\n`
  );
}
