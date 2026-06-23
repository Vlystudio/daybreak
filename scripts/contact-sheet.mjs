// Assemble generated bird sprites into labelled contact sheets for QA.
//   node scripts/contact-sheet.mjs [from] [count] [out.png]
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const BIRDS = JSON.parse(fs.readFileSync("src/data/birds.json", "utf8"));
const from = Number(process.argv[2] ?? 0);
const count = Number(process.argv[3] ?? BIRDS.length);
const out = process.argv[4] ?? "C:/Users/benma/AppData/Local/Temp/bird-contact.png";
const list = BIRDS.slice(from, from + count);

const cols = 5;
const cell = 200;
const labelH = 22;
const rowH = cell + labelH;
const rows = Math.ceil(list.length / cols);
const W = cols * cell;
const H = rows * rowH;

const composites = [];
const labels = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#eef1ea"/>`];

for (let i = 0; i < list.length; i++) {
  const b = list[i];
  const cx = (i % cols) * cell;
  const cy = Math.floor(i / cols) * rowH;
  const file = path.join("public/assets/birds", `${b.id}.png`);
  if (fs.existsSync(file)) {
    const buf = await sharp(file).resize(cell - 16, cell - 16, { fit: "inside" }).toBuffer();
    composites.push({ input: buf, left: cx + 8, top: cy + 8 });
  } else {
    labels.push(`<text x="${cx + cell / 2}" y="${cy + cell / 2}" font-family="sans-serif" font-size="13" fill="#b04a3a" text-anchor="middle">missing</text>`);
  }
  labels.push(`<text x="${cx + cell / 2}" y="${cy + cell + 15}" font-family="sans-serif" font-size="11" fill="#3a352e" text-anchor="middle">${from + i + 1}. ${b.commonName}</text>`);
}
labels.push("</svg>");

const base = await sharp(Buffer.from(labels.join(""))).png().toBuffer();
await sharp(base).composite(composites).png().toFile(out);
console.log("wrote", out, `(${composites.length}/${list.length} present)`);
