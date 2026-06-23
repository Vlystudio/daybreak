/**
 * Per-species bird illustration engine — three-quarter "plush" view.
 *
 * Birds face the viewer (turned ~3/4 so the bill still reads) and are shaded for
 * depth: each rounded form is filled with a radial gradient (top-left highlight
 * → bottom-right shadow), seams get soft ambient-occlusion, and there's a
 * ground shadow + eye catchlights. The result looks dimensional/tactile rather
 * than a flat side-profile decal.
 *
 * A species is still pure data: a silhouette TEMPLATE (round songbird, big-head
 * owl, tall wader, wide duck, upright raptor/seabird…) + an ordered stack of
 * FIELD MARKS (caps, masks, cheeks, bibs, eyebrows, wing bars, breast spots,
 * collars, barring, crests, bill shape). The same `BirdArt` recipes drive both
 * this in-app sprite and the exported asset files.
 */

import type { BirdPalette } from "@/lib/game/birds";

export type TemplateKind =
  | "perch"
  | "upright"
  | "cling"
  | "flit"
  | "hover"
  | "wader"
  | "raptor"
  | "owl"
  | "float"
  | "goose"
  | "seabird"
  | "shorebird"
  | "gamebird";

export type BillKind =
  | "cone"
  | "thin"
  | "stout"
  | "hook"
  | "chisel"
  | "dagger"
  | "decurved"
  | "huge"
  | "spatula"
  | "long";

export type CrestKind = "none" | "spike" | "shag" | "sweep" | "tuft" | "horns";
export type TailKind = "short" | "medium" | "long" | "fan" | "fork" | "cock" | "point" | "updown";
export type Length = "short" | "medium" | "long";

export type Mark =
  | { m: "hood"; color: string }
  | { m: "cap"; color: string; extent?: "small" | "full" }
  | { m: "mask"; color: string }
  | { m: "eyeline"; color: string }
  | { m: "eyebrow"; color: string }
  | { m: "eyering"; color: string }
  | { m: "forehead"; color: string }
  | { m: "cheek"; color: string }
  | { m: "throat"; color: string }
  | { m: "bib"; color: string }
  | { m: "malar"; color: string }
  | { m: "collar"; color: string }
  | { m: "nape"; color: string }
  | { m: "crownStripe"; color: string }
  | { m: "facelines"; color: string }
  | { m: "breastBand"; color: string; count?: 1 | 2 }
  | { m: "breastWash"; color: string }
  | { m: "breastSpot"; color: string }
  | { m: "breastTriangle"; color: string }
  | { m: "streaks"; color: string }
  | { m: "scaly"; color: string }
  | { m: "wingbars"; color: string; count?: 1 | 2 }
  | { m: "wingPatch"; color: string }
  | { m: "epaulet"; color: string; edge?: string }
  | { m: "ladderback"; color: string }
  | { m: "barback"; color: string }
  | { m: "checker"; color: string }
  | { m: "spots"; color: string }
  | { m: "wingtips"; color: string }
  | { m: "tailband"; color: string }
  | { m: "tailtip"; color: string }
  | { m: "undertail"; color: string }
  | { m: "billspot"; color: string };

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

/* ── colour helpers (for plush shading) ────────────────────────────────── */
const clamp = (v: number) => Math.max(0, Math.min(255, v));
function hexToRgb(h: string): [number, number, number] {
  let s = h.replace("#", "");
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((x) => clamp(Math.round(x)).toString(16).padStart(2, "0")).join("");
/** amt > 0 lightens toward white, amt < 0 darkens toward black. */
function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  return toHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p);
}

/* ── svg helpers ───────────────────────────────────────────────────────── */
const n = (v: number) => Math.round(v * 100) / 100;
const ell = (cx: number, cy: number, rx: number, ry: number, fill: string, extra = "") =>
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}"${extra ? " " + extra : ""}/>`;
const circ = (cx: number, cy: number, r: number, fill: string, extra = "") =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}"${extra ? " " + extra : ""}/>`;
const path = (d: string, fill: string, extra = "") => `<path d="${d}" fill="${fill}"${extra ? " " + extra : ""}/>`;
const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, w: number) =>
  `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>`;
const rrect = (x: number, y: number, w: number, h: number, fill: string, extra = "") =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"${extra ? " " + extra : ""}/>`;

/** Front-view anchors so marks place themselves without raw coordinates. */
interface Anchor {
  headCx: number;
  headCy: number;
  headR: number;
  eyeLx: number;
  eyeRx: number;
  eyeY: number;
  eyeR: number;
  billX: number;
  billY: number;
  bodyCx: number;
  bodyCy: number;
  bodyRx: number;
  bodyRy: number;
  bellyCy: number;
  wingLx: number;
  wingRx: number;
  wingY: number;
  wingRyHalf: number;
  neckY: number;
  breastY: number;
  tailX: number;
  tailY: number;
}

interface Fills {
  body: string;
  head: string;
  belly: string;
  wing: string;
  bodyBase: string;
  wingBase: string;
}

interface Built {
  behind: string;
  body: string;
  anchor: Anchor;
}

type TemplateFn = (p: BirdPalette, art: BirdArt, F: Fills) => Built;

/* ── shared parts ──────────────────────────────────────────────────────── */
function legsFront(cx: number, topY: number, len: number, color: string, spread: number) {
  const toe = (x: number, y: number) =>
    line(x, y, x - 2.2, y + 1.8, color, 1.3) + line(x, y, x, y + 2, color, 1.3) + line(x, y, x + 2.2, y + 1.8, color, 1.3);
  return (
    line(cx - spread, topY, cx - spread, topY + len, shade(color, -0.1), 2.2) +
    line(cx + spread, topY, cx + spread, topY + len, color, 2.2) +
    toe(cx - spread, topY + len) +
    toe(cx + spread, topY + len)
  );
}

function tailBehind(kind: TailKind, x: number, y: number, color: string) {
  switch (kind) {
    case "long":
    case "point":
      return path(`M${x - 5} ${y} L${x + 5} ${y} L${x + 2} ${y + 26} L${x - 2} ${y + 26} Z`, color);
    case "fan":
      return path(`M${x - 14} ${y - 2} Q${x} ${y + 18} ${x + 14} ${y - 2} L${x + 9} ${y + 12} Q${x} ${y + 16} ${x - 9} ${y + 12} Z`, color);
    case "fork":
      return path(`M${x - 6} ${y} L${x + 6} ${y} L${x + 9} ${y + 18} L${x + 3} ${y + 12} L${x} ${y + 16} L${x - 3} ${y + 12} L${x - 9} ${y + 18} Z`, color);
    case "cock":
    case "updown":
      return path(`M${x - 5} ${y} L${x + 5} ${y} L${x + 4} ${y - 16} L${x - 4} ${y - 16} Z`, color);
    case "short":
      return path(`M${x - 5} ${y} L${x + 5} ${y} L${x + 3} ${y + 10} L${x - 3} ${y + 10} Z`, color);
    case "medium":
    default:
      return path(`M${x - 5} ${y} L${x + 5} ${y} L${x + 2} ${y + 17} L${x - 2} ${y + 17} Z`, color);
  }
}

function billFront(kind: BillKind, x: number, y: number, color: string, dark: string) {
  const hi = shade(color, 0.18);
  switch (kind) {
    case "thin":
      return path(`M${x - 1.4} ${y} L${x + 1.4} ${y} L${x + 0.6} ${y + 7} L${x - 0.6} ${y + 7} Z`, color);
    case "cone":
      return path(`M${x - 3} ${y - 0.5} L${x + 3} ${y - 0.5} L${x} ${y + 6} Z`, color) + path(`M${x - 3} ${y - 0.5} L${x} ${y - 0.5} L${x} ${y + 6} Z`, hi);
    case "stout":
      return path(`M${x - 3.4} ${y} Q${x} ${y - 1} ${x + 3.4} ${y} L${x} ${y + 6} Z`, color);
    case "chisel":
      return path(`M${x - 2.4} ${y - 1} L${x + 2.4} ${y - 1} L${x + 1.4} ${y + 11} L${x - 1.4} ${y + 11} Z`, color);
    case "dagger":
      return path(`M${x - 2.4} ${y - 1} L${x + 2.4} ${y - 1} L${x + 0.8} ${y + 16} L${x - 0.8} ${y + 16} Z`, color) + line(x, y, x, y + 15, dark, 0.5);
    case "long":
      return path(`M${x - 1.8} ${y - 1} L${x + 1.8} ${y - 1} L${x + 0.7} ${y + 22} L${x - 0.7} ${y + 22} Z`, color);
    case "decurved":
      return path(`M${x - 2.2} ${y - 1} L${x + 2.2} ${y - 1} Q${x + 5} ${y + 8} ${x + 1} ${y + 11} Q${x} ${y + 6} ${x - 2} ${y + 4} Z`, color);
    case "hook":
      return path(`M${x - 3.2} ${y - 1} L${x + 3.2} ${y - 1} Q${x + 2.6} ${y + 6} ${x} ${y + 9} Q${x - 1} ${y + 6} ${x} ${y + 5} Q${x - 2} ${y + 3} ${x - 3.2} ${y - 1} Z`, color) +
        path(`M${x} ${y + 6} Q${x + 1.5} ${y + 8} ${x} ${y + 9.5} Z`, dark);
    case "spatula":
      return path(`M${x - 5} ${y - 1} Q${x} ${y - 2.5} ${x + 5} ${y - 1} L${x + 6} ${y + 7} Q${x} ${y + 9.5} ${x - 6} ${y + 7} Z`, color) +
        ell(x, y + 7.5, 6, 1.6, dark, 'opacity="0.5"');
    case "huge":
      return (
        path(`M${x - 7} ${y - 4} Q${x} ${y - 6} ${x + 7} ${y - 4} L${x + 5} ${y + 9} Q${x} ${y + 12} ${x - 5} ${y + 9} Z`, color) +
        path(`M${x - 7} ${y - 4} Q${x} ${y - 6} ${x + 7} ${y - 4} L${x + 5.5} ${y} Q${x} ${y - 1} ${x - 5.5} ${y} Z`, shade("#9aa6b0", 0)) +
        line(x - 2.5, y - 4.5, x - 1.8, y + 10, dark, 0.6)
      );
    default:
      return path(`M${x - 2.6} ${y} L${x + 2.6} ${y} L${x} ${y + 6} Z`, color);
  }
}

function crestFront(kind: CrestKind, a: Anchor, color: string) {
  const x = a.headCx;
  const top = a.headCy - a.headR;
  switch (kind) {
    case "spike":
      return path(`M${x - 4} ${top + 5} L${x + 1} ${top - 13} L${x + 6} ${top + 4} Z`, color);
    case "sweep":
      return path(`M${x - 2} ${top + 4} Q${x + 8} ${top - 12} ${x + 13} ${top - 8} Q${x + 6} ${top - 2} ${x + 4} ${top + 3} Z`, color);
    case "shag":
      return (
        path(`M${x - 6} ${top + 4} L${x - 3} ${top - 9} L${x} ${top + 3} Z`, color) +
        path(`M${x - 1} ${top + 3} L${x + 3} ${top - 11} L${x + 6} ${top + 3} Z`, color) +
        path(`M${x + 4} ${top + 4} L${x + 8} ${top - 7} L${x + 9} ${top + 4} Z`, color)
      );
    case "tuft":
      return path(`M${x - 3} ${top + 4} Q${x + 2} ${top - 12} ${x + 7} ${top - 8} Q${x + 3} ${top - 2} ${x + 3} ${top + 3} Z`, color);
    case "horns":
      return (
        path(`M${x - a.headR * 0.62} ${top + 8} l-3 -10 l7 5 Z`, color) +
        path(`M${x + a.headR * 0.62} ${top + 8} l3 -10 l-7 5 Z`, color)
      );
    default:
      return "";
  }
}

function eyesFront(a: Anchor, o: RenderOpts, opts?: { big?: boolean; disc?: boolean; iris?: string }) {
  const dark = "#241f1c";
  const r = opts?.big ? a.eyeR * 1.55 : a.eyeR;
  if (o.sleeping || o.mood === "sleepy") {
    return (
      `<g stroke="${dark}" stroke-width="1.5" stroke-linecap="round" fill="none">` +
      `<path d="M${n(a.eyeLx - r)} ${n(a.eyeY)} Q${n(a.eyeLx)} ${n(a.eyeY + r * 0.8)} ${n(a.eyeLx + r)} ${n(a.eyeY)}"/>` +
      `<path d="M${n(a.eyeRx - r)} ${n(a.eyeY)} Q${n(a.eyeRx)} ${n(a.eyeY + r * 0.8)} ${n(a.eyeRx + r)} ${n(a.eyeY)}"/>` +
      `</g>`
    );
  }
  const dy = o.mood === "happy" ? -0.5 : 0;
  const iris = opts?.iris;
  const one = (cx: number) =>
    (opts?.disc ? circ(cx, a.eyeY, r + 1.4, "#fdf6e6") : "") +
    (iris ? circ(cx, a.eyeY, r, iris) + circ(cx, a.eyeY + dy, r * 0.62, dark) : circ(cx, a.eyeY + dy, r, dark)) +
    circ(cx - r * 0.32, a.eyeY - r * 0.34 + dy, r * 0.34, "#fff", 'opacity="0.92"');
  const blink = o.animated ? ` class="bird-blink" style="transform-origin:${n(a.headCx)}px ${n(a.eyeY)}px"` : "";
  return `<g${blink}>${one(a.eyeLx)}${one(a.eyeRx)}</g>`;
}

/* ── templates (front / three-quarter) ─────────────────────────────────── */
const ROUND: TemplateFn = (p, art, F) => {
  const A: Anchor = {
    headCx: 50, headCy: 33, headR: 18,
    eyeLx: 43, eyeRx: 58, eyeY: 32, eyeR: 3.4,
    billX: 51, billY: 39,
    bodyCx: 50, bodyCy: 66, bodyRx: 25, bodyRy: 27,
    bellyCy: 72, wingLx: 29, wingRx: 71, wingY: 66, wingRyHalf: 18,
    neckY: 48, breastY: 64, tailX: 47, tailY: 88,
  };
  const legLen = art.legs === "long" ? 14 : art.legs === "short" ? 6 : 9;
  return {
    behind:
      tailBehind(art.tail ?? "medium", A.tailX, A.tailY, F.wingBase) +
      legsFront(50, 86, legLen, p.beak, 7),
    body:
      ell(A.wingLx, A.wingY, 9, A.wingRyHalf, F.wing) +
      ell(A.wingRx, A.wingY, 9, A.wingRyHalf, F.wing) +
      ell(A.bodyCx, A.bodyCy, A.bodyRx, A.bodyRy, F.body) +
      ell(A.bodyCx, A.bellyCy, 16, 18, F.belly) +
      ell(50, 50, 18, 12, shade(F.bodyBase, -0.14), 'opacity="0.5"') + // neck AO
      circ(A.headCx, A.headCy, A.headR, F.head),
    anchor: A,
  };
};

const OWL: TemplateFn = (p, art, F) => {
  const A: Anchor = {
    headCx: 50, headCy: 35, headR: 25,
    eyeLx: 41, eyeRx: 59, eyeY: 35, eyeR: 6.2,
    billX: 50, billY: 41,
    bodyCx: 50, bodyCy: 70, bodyRx: 27, bodyRy: 27,
    bellyCy: 74, wingLx: 26, wingRx: 74, wingY: 70, wingRyHalf: 22,
    neckY: 54, breastY: 66, tailX: 50, tailY: 92,
  };
  return {
    behind: legsFront(50, 90, 5, p.beak, 8),
    body:
      ell(A.wingLx, A.wingY, 9, A.wingRyHalf, F.wing) +
      ell(A.wingRx, A.wingY, 9, A.wingRyHalf, F.wing) +
      ell(A.bodyCx, A.bodyCy, A.bodyRx, A.bodyRy, F.body) +
      ell(A.bodyCx, A.bellyCy, 19, 22, F.belly) +
      circ(A.headCx, A.headCy, A.headR, F.head) +
      // facial disc
      ell(41, 37, 11, 14, shade(F.bodyBase, 0.16), 'opacity="0.6"') +
      ell(59, 37, 11, 14, shade(F.bodyBase, 0.16), 'opacity="0.6"'),
    anchor: A,
  };
};

const RAPTOR: TemplateFn = (p, art, F) => {
  const A: Anchor = {
    headCx: 50, headCy: 30, headR: 16,
    eyeLx: 43, eyeRx: 57, eyeY: 29, eyeR: 3.4,
    billX: 50, billY: 37,
    bodyCx: 50, bodyCy: 66, bodyRx: 21, bodyRy: 29,
    bellyCy: 70, wingLx: 31, wingRx: 69, wingY: 64, wingRyHalf: 24,
    neckY: 46, breastY: 62, tailX: 50, tailY: 92,
  };
  return {
    behind: tailBehind(art.tail ?? "medium", A.tailX, A.tailY, F.wingBase) + legsFront(50, 88, 6, p.beak, 7),
    body:
      ell(A.wingLx, A.wingY, 9, A.wingRyHalf, F.wing) +
      ell(A.wingRx, A.wingY, 9, A.wingRyHalf, F.wing) +
      ell(A.bodyCx, A.bodyCy, A.bodyRx, A.bodyRy, F.body) +
      ell(A.bodyCx, A.bellyCy, 14, 22, F.belly) +
      circ(A.headCx, A.headCy, A.headR, F.head) +
      // heavy brow
      path(`M37 28 Q50 19 63 28 L63 31 Q50 24 37 31 Z`, shade(F.bodyBase, -0.16)),
    anchor: A,
  };
};

const DUCK: TemplateFn = (p, art, F) => {
  const A: Anchor = {
    headCx: 50, headCy: 30, headR: 16,
    eyeLx: 44, eyeRx: 56, eyeY: 28, eyeR: 3,
    billX: 50, billY: 38,
    bodyCx: 50, bodyCy: 66, bodyRx: 31, bodyRy: 20,
    bellyCy: 70, wingLx: 23, wingRx: 77, wingY: 64, wingRyHalf: 14,
    neckY: 46, breastY: 62, tailX: 50, tailY: 80,
  };
  return {
    behind:
      ell(50, 82, 36, 5, shade(F.bodyBase, 0.2), 'opacity="0.4"') + // waterline
      tailBehind("short", 78, 60, F.wingBase),
    body:
      ell(A.bodyCx, A.bodyCy, A.bodyRx, A.bodyRy, F.body) +
      ell(A.wingLx + 6, A.wingY, 11, A.wingRyHalf, F.wing) +
      ell(A.wingRx - 6, A.wingY, 11, A.wingRyHalf, F.wing) +
      ell(A.bodyCx, A.bellyCy, 20, 12, F.belly) +
      circ(A.headCx, A.headCy, A.headR, F.head),
    anchor: A,
  };
};

const GOOSE: TemplateFn = (p, art, F) => {
  const A: Anchor = {
    headCx: 50, headCy: 18, headR: 12,
    eyeLx: 45, eyeRx: 55, eyeY: 16, eyeR: 2.4,
    billX: 50, billY: 25,
    bodyCx: 50, bodyCy: 68, bodyRx: 28, bodyRy: 22,
    bellyCy: 72, wingLx: 26, wingRx: 74, wingY: 66, wingRyHalf: 16,
    neckY: 40, breastY: 60, tailX: 50, tailY: 84,
  };
  return {
    behind: ell(50, 84, 32, 5, shade(F.bodyBase, 0.2), 'opacity="0.35"'),
    body:
      ell(A.wingLx, A.wingY, 10, A.wingRyHalf, F.wing) +
      ell(A.wingRx, A.wingY, 10, A.wingRyHalf, F.wing) +
      ell(A.bodyCx, A.bodyCy, A.bodyRx, A.bodyRy, F.body) +
      ell(A.bodyCx, A.bellyCy, 18, 16, F.belly) +
      rrect(46, 26, 8, 26, F.head) + // neck
      circ(A.headCx, A.headCy, A.headR, F.head),
    anchor: A,
  };
};

const WADER: TemplateFn = (p, art, F) => {
  const A: Anchor = {
    headCx: 50, headCy: 16, headR: 11,
    eyeLx: 45, eyeRx: 55, eyeY: 14, eyeR: 2.2,
    billX: 50, billY: 23,
    bodyCx: 50, bodyCy: 56, bodyRx: 20, bodyRy: 17,
    bellyCy: 60, wingLx: 32, wingRx: 68, wingY: 56, wingRyHalf: 14,
    neckY: 36, breastY: 50, tailX: 50, tailY: 70,
  };
  const legLen = art.legs === "short" ? 14 : 28;
  return {
    behind:
      legsFront(50, 70, legLen, p.beak, 6) +
      tailBehind("short", 50, 66, F.wingBase),
    body:
      ell(A.wingLx, A.wingY, 9, A.wingRyHalf, F.wing) +
      ell(A.wingRx, A.wingY, 9, A.wingRyHalf, F.wing) +
      ell(A.bodyCx, A.bodyCy, A.bodyRx, A.bodyRy, F.body) +
      ell(A.bodyCx, A.bellyCy, 13, 13, F.belly) +
      rrect(46.5, 22, 7, 24, F.head) + // long neck
      circ(A.headCx, A.headCy, A.headR, F.head),
    anchor: A,
  };
};

const SEABIRD: TemplateFn = (p, art, F) => {
  const A: Anchor = {
    headCx: 50, headCy: 28, headR: 16,
    eyeLx: 44, eyeRx: 56, eyeY: 26, eyeR: 2.8,
    billX: 50, billY: 35,
    bodyCx: 50, bodyCy: 66, bodyRx: 21, bodyRy: 28,
    bellyCy: 70, wingLx: 30, wingRx: 70, wingY: 66, wingRyHalf: 22,
    neckY: 46, breastY: 62, tailX: 50, tailY: 92,
  };
  const legLen = art.legs === "long" ? 11 : 7;
  return {
    behind: legsFront(50, 89, legLen, p.beak, 7) + tailBehind("short", 50, 90, F.wingBase),
    body:
      ell(A.wingLx, A.wingY, 9, A.wingRyHalf, F.wing) +
      ell(A.wingRx, A.wingY, 9, A.wingRyHalf, F.wing) +
      ell(A.bodyCx, A.bodyCy, A.bodyRx, A.bodyRy, F.body) +
      ell(A.bodyCx, A.bellyCy, 15, 23, F.belly) +
      circ(A.headCx, A.headCy, A.headR, F.head),
    anchor: A,
  };
};

const SHORE: TemplateFn = (p, art, F) => {
  const A: Anchor = {
    headCx: 50, headCy: 28, headR: 14,
    eyeLx: 44, eyeRx: 56, eyeY: 26, eyeR: 2.8,
    billX: 50, billY: 35,
    bodyCx: 50, bodyCy: 58, bodyRx: 22, bodyRy: 18,
    bellyCy: 62, wingLx: 31, wingRx: 69, wingY: 58, wingRyHalf: 15,
    neckY: 44, breastY: 54, tailX: 50, tailY: 74,
  };
  const legLen = art.legs === "long" ? 20 : art.legs === "short" ? 9 : 14;
  return {
    behind: legsFront(50, 72, legLen, p.beak, 6) + tailBehind("short", 50, 70, F.wingBase),
    body:
      ell(A.wingLx, A.wingY, 9, A.wingRyHalf, F.wing) +
      ell(A.wingRx, A.wingY, 9, A.wingRyHalf, F.wing) +
      ell(A.bodyCx, A.bodyCy, A.bodyRx, A.bodyRy, F.body) +
      ell(A.bodyCx, A.bellyCy, 15, 13, F.belly) +
      circ(A.headCx, A.headCy, A.headR, F.head),
    anchor: A,
  };
};

const GAME: TemplateFn = (p, art, F) => {
  const A: Anchor = {
    headCx: 50, headCy: 24, headR: 11,
    eyeLx: 45, eyeRx: 55, eyeY: 22, eyeR: 2.4,
    billX: 50, billY: 30,
    bodyCx: 50, bodyCy: 64, bodyRx: 27, bodyRy: 23,
    bellyCy: 68, wingLx: 26, wingRx: 74, wingY: 64, wingRyHalf: 18,
    neckY: 42, breastY: 56, tailX: 50, tailY: 86,
  };
  const legLen = art.legs === "long" ? 14 : 10;
  return {
    behind:
      tailBehind(art.tail === "fan" ? "fan" : "medium", A.tailX, 84, F.wingBase) +
      legsFront(50, 84, legLen, p.beak, 8),
    body:
      ell(A.wingLx, A.wingY, 11, A.wingRyHalf, F.wing) +
      ell(A.wingRx, A.wingY, 11, A.wingRyHalf, F.wing) +
      ell(A.bodyCx, A.bodyCy, A.bodyRx, A.bodyRy, F.body) +
      ell(A.bodyCx, A.bellyCy, 18, 16, F.belly) +
      rrect(46.5, 28, 7, 16, F.head) +
      circ(A.headCx, A.headCy, A.headR, F.head),
    anchor: A,
  };
};

const HOVER: TemplateFn = (p, art, F) => {
  const A: Anchor = {
    headCx: 50, headCy: 36, headR: 12,
    eyeLx: 45, eyeRx: 55, eyeY: 34, eyeR: 2.6,
    billX: 50, billY: 43,
    bodyCx: 50, bodyCy: 60, bodyRx: 15, bodyRy: 18,
    bellyCy: 64, wingLx: 26, wingRx: 74, wingY: 52, wingRyHalf: 7,
    neckY: 48, breastY: 56, tailX: 50, tailY: 78,
  };
  return {
    behind:
      ell(28, 54, 16, 7, F.wing, 'opacity="0.55"') +
      ell(72, 54, 16, 7, F.wing, 'opacity="0.55"') +
      tailBehind("short", 50, 76, F.wingBase),
    body:
      ell(A.bodyCx, A.bodyCy, A.bodyRx, A.bodyRy, F.body) +
      ell(A.bodyCx, A.bellyCy, 10, 12, F.belly) +
      circ(A.headCx, A.headCy, A.headR, F.head),
    anchor: A,
  };
};

const FLIT: TemplateFn = (p, art, F) => {
  const A: Anchor = {
    headCx: 50, headCy: 34, headR: 13,
    eyeLx: 45, eyeRx: 55, eyeY: 32, eyeR: 2.8,
    billX: 50, billY: 40,
    bodyCx: 50, bodyCy: 58, bodyRx: 16, bodyRy: 20,
    bellyCy: 62, wingLx: 22, wingRx: 78, wingY: 48, wingRyHalf: 8,
    neckY: 46, breastY: 54, tailX: 50, tailY: 78,
  };
  return {
    behind:
      path(`M36 50 Q14 36 4 48 Q20 52 38 56 Z`, F.wing) +
      path(`M64 50 Q86 36 96 48 Q80 52 62 56 Z`, F.wing) +
      tailBehind(art.tail ?? "fork", A.tailX, A.tailY, F.wingBase),
    body:
      ell(A.bodyCx, A.bodyCy, A.bodyRx, A.bodyRy, F.body) +
      ell(A.bodyCx, A.bellyCy, 11, 14, F.belly) +
      circ(A.headCx, A.headCy, A.headR, F.head),
    anchor: A,
  };
};

const TEMPLATES: Record<TemplateKind, TemplateFn> = {
  perch: ROUND,
  upright: ROUND,
  cling: ROUND,
  flit: FLIT,
  hover: HOVER,
  wader: WADER,
  raptor: RAPTOR,
  owl: OWL,
  float: DUCK,
  goose: GOOSE,
  seabird: SEABIRD,
  shorebird: SHORE,
  gamebird: GAME,
};

/* ── marks (front view) ────────────────────────────────────────────────── */
function renderMark(mk: Mark, a: Anchor, u: string): string {
  const hc = `clip-path="url(#h${u})"`;
  const bc = `clip-path="url(#b${u})"`;
  const wc = `clip-path="url(#w${u})"`;
  const { headCx: hx, headCy: hy, headR: hr, eyeLx: lx, eyeRx: rx, eyeY: ey } = a;

  switch (mk.m) {
    case "hood":
      return circ(hx, hy, hr + 0.4, mk.color) + ell(hx, hy + hr - 1, 8, 5, mk.color, bc);
    case "cap":
      return rrect(hx - hr - 1, hy - hr - 1, (hr + 1) * 2, hr + (mk.extent === "full" ? hr * 0.85 : hr * 0.45), mk.color, hc);
    case "forehead":
      return rrect(hx - hr - 1, hy - hr - 1, (hr + 1) * 2, hr * 0.48, mk.color, hc);
    case "mask":
      return rrect(hx - hr - 1, ey - hr * 0.22, (hr + 1) * 2, hr * 0.5, mk.color, hc);
    case "eyeline":
      return ell(lx, ey, 4, 1.6, mk.color, hc) + ell(rx, ey, 4, 1.6, mk.color, hc);
    case "eyebrow":
      return ell(lx, ey - hr * 0.32, 3.6, 1.4, mk.color, hc) + ell(rx, ey - hr * 0.32, 3.6, 1.4, mk.color, hc);
    case "eyering":
      return circ(lx, ey, a.eyeR + 1.6, "none", `stroke="${mk.color}" stroke-width="1.3" ${hc}`) +
        circ(rx, ey, a.eyeR + 1.6, "none", `stroke="${mk.color}" stroke-width="1.3" ${hc}`);
    case "cheek":
      return ell(lx, ey + hr * 0.34, 5.5, 5, mk.color, hc) + ell(rx, ey + hr * 0.34, 5.5, 5, mk.color, hc);
    case "throat":
      return ell(hx, hy + hr - 0.5, 6, 5.5, mk.color, hc);
    case "bib":
      return ell(hx, hy + hr - 1, 7, 6, mk.color, hc) + ell(hx, a.breastY - 4, 8, 7, mk.color, bc);
    case "malar":
      return ell(hx - 5, hy + hr * 0.6, 1.6, 4, mk.color, hc) + ell(hx + 5, hy + hr * 0.6, 1.6, 4, mk.color, hc);
    case "collar":
      return ell(hx, a.neckY, a.bodyRx * 0.7, 3, mk.color, bc);
    case "nape":
      return rrect(hx - hr - 1, hy - hr - 1, (hr + 1) * 2, 3, mk.color, hc);
    case "crownStripe":
      return rrect(hx - 1.4, hy - hr - 1, 2.8, hr * 0.9, mk.color, hc);
    case "facelines":
      return ell(hx - 6, ey + 2, 1.4, 6, "#fff", hc) + ell(hx + 6, ey + 2, 1.4, 6, "#fff", hc);
    case "breastBand":
      return (
        ell(hx, a.breastY, a.bodyRx * 0.78, 3, mk.color, bc) +
        (mk.count === 2 ? ell(hx, a.breastY + 7, a.bodyRx * 0.78, 2.8, mk.color, bc) : "")
      );
    case "breastWash":
      return ell(hx, a.breastY + 4, 13, 12, mk.color, bc);
    case "breastSpot":
      return circ(hx, a.breastY + 5, 3.6, mk.color, bc);
    case "breastTriangle":
      return path(`M${hx - 8} ${a.breastY - 3} L${hx + 8} ${a.breastY - 3} L${hx} ${a.breastY + 11} Z`, mk.color, bc);
    case "streaks":
      return [-9, -4.5, 0, 4.5, 9].map((dx) => rrect(hx + dx - 0.7, a.breastY - 6, 1.5, 18, mk.color, bc)).join("");
    case "scaly":
      return [-10, 0, 10, -5, 5].map((dx, i) => circ(hx + dx, a.bodyCy - 4 + (i % 2) * 9, 2, mk.color, bc)).join("");
    case "wingbars":
      return (
        ell(a.wingLx, a.wingY + 2, 6, 1.5, mk.color, wc) + ell(a.wingRx, a.wingY + 2, 6, 1.5, mk.color, wc) +
        (mk.count === 2 ? ell(a.wingLx, a.wingY + 8, 6, 1.5, mk.color, wc) + ell(a.wingRx, a.wingY + 8, 6, 1.5, mk.color, wc) : "")
      );
    case "wingPatch":
      return ell(a.wingLx, a.wingY + 3, 5, 7, mk.color, wc) + ell(a.wingRx, a.wingY + 3, 5, 7, mk.color, wc);
    case "epaulet":
      return (
        ell(a.wingLx, a.wingY - a.wingRyHalf * 0.4, 5, 4, mk.color, wc) + ell(a.wingRx, a.wingY - a.wingRyHalf * 0.4, 5, 4, mk.color, wc) +
        (mk.edge ? ell(a.wingLx, a.wingY - a.wingRyHalf * 0.4 + 3.5, 5, 1.4, mk.edge, wc) + ell(a.wingRx, a.wingY - a.wingRyHalf * 0.4 + 3.5, 5, 1.4, mk.edge, wc) : "")
      );
    case "ladderback":
      return [0, 1, 2, 3, 4].flatMap((i) => [
        ell(a.wingLx, a.wingY - a.wingRyHalf + 4 + i * 7, 6, 1.6, mk.color, wc),
        ell(a.wingRx, a.wingY - a.wingRyHalf + 4 + i * 7, 6, 1.6, mk.color, wc),
      ]).join("");
    case "barback":
      return [0, 1, 2, 3, 4, 5].map((i) => ell(hx, a.bodyCy - a.bodyRy + 6 + i * 7, a.bodyRx * 0.82, 1.8, mk.color, bc)).join("");
    case "checker":
      return [-12, -2, 8].flatMap((dx, c) => [-8, 1, 10].map((dy, r2) => ((c + r2) % 2 === 0 ? rrect(hx + dx, a.bodyCy + dy, 5, 5, mk.color, bc) : ""))).join("");
    case "spots":
      return [-11, 0, 11, -6, 6].map((dx, i) => circ(hx + dx, a.bodyCy - 4 + (i % 2) * 9, 1.8, mk.color, bc)).join("");
    case "wingtips":
      return ell(a.wingLx, a.wingY + a.wingRyHalf - 4, 6, 4, mk.color, wc) + ell(a.wingRx, a.wingY + a.wingRyHalf - 4, 6, 4, mk.color, wc);
    case "tailband":
      return rrect(a.tailX - 6, a.tailY + 6, 12, 3, mk.color);
    case "tailtip":
      return rrect(a.tailX - 6, a.tailY + 12, 12, 2.6, mk.color);
    case "undertail":
      return ell(a.tailX, a.tailY + 4, 5, 4, mk.color);
    case "billspot":
      return circ(a.billX, a.billY + 5, 1.2, mk.color);
    default:
      return "";
  }
}

/* ── builder ───────────────────────────────────────────────────────────── */
export function renderBirdArt(p: BirdPalette, art: BirdArt, o: RenderOpts): string {
  const u = (o.uid || "x").replace(/[^a-zA-Z0-9]/g, "") || "x";
  const tpl = TEMPLATES[art.template] ?? ROUND;
  const F: Fills = {
    body: `url(#bg${u})`,
    head: `url(#hd${u})`,
    belly: `url(#bl${u})`,
    wing: `url(#wg${u})`,
    bodyBase: p.body,
    wingBase: p.wing,
  };
  const built = tpl(p, art, F);
  const a = built.anchor;

  const defs =
    `<defs>` +
    sphereGrad(`bg${u}`, p.body) +
    sphereGrad(`hd${u}`, p.body) +
    sphereGrad(`bl${u}`, p.belly) +
    sphereGrad(`wg${u}`, p.wing) +
    `<clipPath id="h${u}"><circle cx="${n(a.headCx)}" cy="${n(a.headCy)}" r="${n(a.headR)}"/></clipPath>` +
    `<clipPath id="b${u}"><ellipse cx="${n(a.bodyCx)}" cy="${n(a.bodyCy)}" rx="${n(a.bodyRx)}" ry="${n(a.bodyRy)}"/></clipPath>` +
    `<clipPath id="w${u}"><ellipse cx="${n(a.wingLx)}" cy="${n(a.wingY)}" rx="9" ry="${n(a.wingRyHalf)}"/><ellipse cx="${n(a.wingRx)}" cy="${n(a.wingY)}" rx="9" ry="${n(a.wingRyHalf)}"/></clipPath>` +
    `</defs>`;

  const groundShadow = ell(50, 95, 26, 4.5, "#000", 'opacity="0.14"');
  const marks = (art.marks ?? []).map((mk) => renderMark(mk, a, u)).join("");
  const isOwl = art.template === "owl";
  const crest = art.crest && art.crest !== "none" ? crestFront(art.crest, a, art.crest === "horns" ? shade(p.wing, -0.05) : p.cheek) : "";
  const bill = billFront(art.bill, a.billX, a.billY, p.beak, shade(p.wing, -0.1));
  const eyeLayer = eyesFront(a, o, { big: isOwl, disc: isOwl });
  // top highlight for a glossy plush sheen
  const sheen = ell(a.headCx - a.headR * 0.34, a.headCy - a.headR * 0.42, a.headR * 0.4, a.headR * 0.26, "#fff", 'opacity="0.16"');

  return defs + groundShadow + built.behind + built.body + marks + crest + bill + eyeLayer + sheen;
}

function sphereGrad(id: string, base: string): string {
  return (
    `<radialGradient id="${id}" cx="36%" cy="28%" r="80%">` +
    `<stop offset="0%" stop-color="${shade(base, 0.3)}"/>` +
    `<stop offset="55%" stop-color="${base}"/>` +
    `<stop offset="100%" stop-color="${shade(base, -0.22)}"/>` +
    `</radialGradient>`
  );
}

/** A full standalone 512×512 SVG document for the exported asset files. */
export function birdArtDocument(opts: { name: string; slug: string; marks: string; palette: BirdPalette; art: BirdArt }): string {
  const inner = renderBirdArt(opts.palette, opts.art, { uid: opts.slug });
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!-- ${opts.name} — ${opts.marks} -->\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100" role="img" aria-label="${opts.name}">\n` +
    `  ${inner}\n` +
    `</svg>\n`
  );
}
