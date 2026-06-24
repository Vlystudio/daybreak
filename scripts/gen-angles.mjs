// Generate turn-angle frames for a bird FROM its existing front sprite (image
// edit, so colours/markings stay consistent). Writes <slug>_l.png / <slug>_r.png.
//   node --use-system-ca scripts/gen-angles.mjs <slug> [--force]
import fs from "node:fs";
import path from "node:path";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1)];
  }),
);
const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
const BIRDS = JSON.parse(fs.readFileSync("src/data/birds.json", "utf8"));
const DIR = "public/assets/birds";

async function normalize(buf) {
  let trimmed;
  try { trimmed = await sharp(buf).trim({ threshold: 12 }).toBuffer(); } catch { trimmed = buf; }
  const fitted = await sharp(trimmed).resize(464, 464, { fit: "inside", withoutEnlargement: false }).toBuffer();
  return sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, gravity: "center" }]).png().toBuffer();
}

async function angle(b, side) {
  const front = path.join(DIR, `${b.id}.png`);
  const imageFile = await toFile(fs.readFileSync(front), `${b.id}.png`, { type: "image/png" });
  const res = await client.images.edit({
    model: "gpt-image-1",
    image: imageFile,
    prompt:
      `Redraw the EXACT same ${b.commonName} from the image — identical colours, markings, body shape, ` +
      `proportions and the same cozy soft 3D vector illustration style — but turned so it faces toward the ` +
      `${side} in a three-quarter view, as if the same bird rotated its body to the ${side}. Keep field marks: ` +
      `${b.fieldMarks.join(", ")}. Single bird, full body, centered, transparent background, no text, no scenery.`,
    size: "1024x1024",
    background: "transparent",
  });
  return normalize(Buffer.from(res.data[0].b64_json, "base64"));
}

const slug = process.argv[2];
const force = process.argv.includes("--force");
const list = slug === "all" ? BIRDS : BIRDS.filter((b) => b.id === slug);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const b of list) {
  for (const [side, suffix] of [["left", "l"], ["right", "r"]]) {
    const dest = path.join(DIR, `${b.id}_${suffix}.png`);
    if (!force && fs.existsSync(dest)) { console.log("skip", b.id, suffix); continue; }
    const start = Date.now();
    let done = false;
    for (let a = 1; a <= 5 && !done; a++) {
      try {
        fs.writeFileSync(dest, await angle(b, side));
        console.log("✓", b.id, suffix);
        done = true;
      } catch (e) {
        console.error(`✗ ${b.id} ${suffix} (try ${a}):`, e?.status ?? "", e?.message ?? e);
        await sleep(e?.status === 429 ? 13000 : 2000);
      }
    }
    const el = Date.now() - start;
    if (el < 13000) await sleep(13000 - el);
  }
}
console.log("done");
