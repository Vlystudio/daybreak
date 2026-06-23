// Generate cozy mobile-game bird sprites via OpenAI Images (gpt-image-1),
// then normalize each to a clean, centered, transparent 512px PNG.
//   node --use-system-ca scripts/gen-birds.mjs <all|slug> [quality] [--force]
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
const BIRDS = JSON.parse(fs.readFileSync("src/data/birds.json", "utf8"));

const STYLE =
  "Cozy mobile wellness-game bird mascot, soft 3D vector illustration, rounded friendly shapes, " +
  "smooth gradient shading with gentle painterly feather detail, muted-but-warm natural colors, a single " +
  "bird centered and shown full-body in a natural three-quarter pose facing slightly toward the viewer, " +
  "one large friendly glossy eye, wholesome and cute but species-accurate, consistent art set. " +
  "Subtle soft drop shadow. STRICTLY: transparent background, no text, no numbers, no labels, no border, " +
  "no grid, no scenery, just the one bird.";

const promptFor = (b) => `${b.commonName} (${b.scientificName}). ${STYLE} Field marks to render accurately: ${b.fieldMarks.join(", ")}.`;

async function normalize(buf) {
  // trim transparent margin, fit within 460px, center on a 512 transparent canvas
  let trimmed;
  try {
    trimmed = await sharp(buf).trim({ threshold: 12 }).toBuffer();
  } catch {
    trimmed = buf;
  }
  const fitted = await sharp(trimmed).resize(464, 464, { fit: "inside", withoutEnlargement: false }).toBuffer();
  return sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, gravity: "center" }])
    .png()
    .toBuffer();
}

async function gen(b, quality, outDir) {
  const res = await client.images.generate({ model: "gpt-image-1", prompt: promptFor(b), size: "1024x1024", background: "transparent", quality, n: 1 });
  const raw = Buffer.from(res.data[0].b64_json, "base64");
  const out = await normalize(raw);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${b.id}.png`), out);
}

const which = process.argv[2] ?? "all";
const quality = (process.argv[3] && !process.argv[3].startsWith("--")) ? process.argv[3] : "high";
const force = process.argv.includes("--force");
const outDir = "public/assets/birds";

const list = which === "all" ? BIRDS : BIRDS.filter((b) => b.id === which);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SPACING_MS = 13000; // gpt-image-1 limit is ~5/min → one start every ~13s
let ok = 0, skip = 0, fail = 0;

const queue = list.filter((b) => {
  const exists = !force && fs.existsSync(path.join(outDir, `${b.id}.png`));
  if (exists) skip++;
  return !exists;
});

for (const b of queue) {
  const started = Date.now();
  let done = false;
  for (let attempt = 1; attempt <= 6 && !done; attempt++) {
    try {
      await gen(b, quality, outDir);
      console.log("✓", b.id);
      ok++;
      done = true;
    } catch (e) {
      const status = e?.status ?? "";
      console.error(`✗ ${b.id} (try ${attempt}):`, status, e?.message ?? e);
      if (status === 429) await sleep(13000);
      else await sleep(2000);
      if (attempt === 6) fail++;
    }
  }
  const elapsed = Date.now() - started;
  if (elapsed < SPACING_MS) await sleep(SPACING_MS - elapsed);
}
console.log(`done — generated ${ok}, skipped ${skip}, failed ${fail}`);
