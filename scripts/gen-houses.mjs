// Generate cozy illustrated bird-house art (several types + a top-down interior
// for the night "sleeping inside" view). Same style as the bird sprites.
//   node --use-system-ca scripts/gen-houses.mjs [quality=medium]
// quality: low|medium|high — medium is ~4x cheaper than high and fine at 512px.
import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import sharp from "sharp";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1)];
  }),
);
const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
const QUALITY = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "medium";
const DIR = "public/assets/houses";
fs.mkdirSync(DIR, { recursive: true });

const STYLE =
  "cozy mobile wellness-game style, soft 3D vector illustration, rounded friendly shapes, smooth gradient " +
  "shading with gentle painterly detail, warm muted natural colors, single object centered, subtle soft drop " +
  "shadow. STRICTLY: transparent background, no text, no labels, no scenery, no bird.";

const HOUSES = [
  ["classic_box", "A classic wooden bird house: a small box with a peaked roof and a round entrance hole near the top, three-quarter view."],
  ["a_frame", "A cute A-frame triangular wooden bird house with a round entrance hole, three-quarter view."],
  ["gourd", "A hanging dried birdhouse gourd (calabash) with a round entrance hole and a little hanging loop, three-quarter view."],
  ["log_cabin", "A tiny rustic log-cabin bird house made of stacked little logs with a round entrance hole, three-quarter view."],
  ["cottage", "A cozy storybook cottage bird house with a tiny chimney, a flower box, and a round door hole, three-quarter view."],
  ["modern", "A sleek modern minimalist bird house, clean angular wood and white, round entrance hole, three-quarter view."],
];
const INTERIOR = ["interior", "Top-down view looking straight down into an open cozy bird house nest box: soft straw nest bedding in the middle, simple wooden interior walls around the edges, viewed from directly above."];

async function gen(id, prompt) {
  const dest = path.join(DIR, `${id}.png`);
  if (fs.existsSync(dest)) { console.log("skip", id); return; }
  const res = await client.images.generate({ model: "gpt-image-1", prompt: `${prompt} ${STYLE}`, size: "1024x1024", background: "transparent", quality: QUALITY, n: 1 });
  let buf = Buffer.from(res.data[0].b64_json, "base64");
  try { buf = await sharp(buf).trim({ threshold: 12 }).toBuffer(); } catch {}
  const fit = await sharp(buf).resize(472, 472, { fit: "inside" }).toBuffer();
  const out = await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: fit, gravity: "center" }]).png().toBuffer();
  fs.writeFileSync(dest, out);
  console.log("✓", id);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [id, prompt] of [...HOUSES, INTERIOR]) {
  const s = Date.now();
  for (let a = 1; a <= 5; a++) {
    try { await gen(id, prompt); break; }
    catch (e) { console.error(`x ${id} (try ${a})`, e?.status ?? "", e?.message ?? e); await sleep(e?.status === 429 ? 13000 : 2000); }
  }
  const el = Date.now() - s; if (el < 13000) await sleep(13000 - el);
}
console.log("done");
