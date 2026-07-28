import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = await readFile(path.join(root, "public", "icon.svg"));
// App Store icons must be opaque, full-bleed squares. iOS applies its own corner
// mask, so remove the PWA artwork's baked-in rounded rectangle for native use.
const appIconSource = Buffer.from(source.toString("utf8").replace(' rx="112"', ""));
const iconDir = path.join(root, "native", "ios", "AppIcon.appiconset");
const splashDir = path.join(root, "native", "ios", "Splash.imageset");
await mkdir(iconDir, { recursive: true });
await mkdir(splashDir, { recursive: true });

const specs = [
  ["iphone", "20x20", "2x", 40],
  ["iphone", "20x20", "3x", 60],
  ["iphone", "29x29", "2x", 58],
  ["iphone", "29x29", "3x", 87],
  ["iphone", "40x40", "2x", 80],
  ["iphone", "40x40", "3x", 120],
  ["iphone", "60x60", "2x", 120],
  ["iphone", "60x60", "3x", 180],
  ["ipad", "20x20", "1x", 20],
  ["ipad", "20x20", "2x", 40],
  ["ipad", "29x29", "1x", 29],
  ["ipad", "29x29", "2x", 58],
  ["ipad", "40x40", "1x", 40],
  ["ipad", "40x40", "2x", 80],
  ["ipad", "76x76", "1x", 76],
  ["ipad", "76x76", "2x", 152],
  ["ipad", "83.5x83.5", "2x", 167],
];
const images = [];
for (const [idiom, size, scale, pixels] of specs) {
  const filename = `AppIcon-${pixels}.png`;
  await sharp(appIconSource)
    .resize(pixels, pixels)
    .flatten({ background: "#f4a23c" })
    .removeAlpha()
    .png()
    .toFile(path.join(iconDir, filename));
  images.push({ idiom, size, scale, filename });
}
await sharp(appIconSource)
  .resize(1024, 1024)
  .flatten({ background: "#f4a23c" })
  .removeAlpha()
  .png()
  .toFile(path.join(iconDir, "AppIcon-1024.png"));
images.push({
  idiom: "ios-marketing",
  size: "1024x1024",
  scale: "1x",
  filename: "AppIcon-1024.png",
});
await writeFile(
  path.join(iconDir, "Contents.json"),
  JSON.stringify({ images, info: { author: "daybreak", version: 1 } }, null, 2) + "\n"
);

// Keep the splash vector-only. System-font text rasterizes differently across
// Windows and Codemagic macOS, which would make the tracked PNG nondeterministic.
const splashSvg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="#fdf9f0"/>
  <rect x="986" y="986" width="760" height="760" rx="180" fill="#f4a23c"/>
  <g stroke="#fff7e6" stroke-width="42" stroke-linecap="round">
    <path d="M1366 1120v90M1190 1190l55 70M1542 1190l-55 70M1100 1360h90M1632 1360h-90"/>
  </g>
  <path d="M1215 1450a151 151 0 0 1 302 0z" fill="#fff7e6"/>
  <rect x="1130" y="1470" width="472" height="42" rx="21" fill="#fff7e6"/>
</svg>`);
await sharp(splashSvg)
  .flatten({ background: "#fdf9f0" })
  .removeAlpha()
  .png()
  .toFile(path.join(splashDir, "Splash-2732.png"));
await writeFile(
  path.join(splashDir, "Contents.json"),
  JSON.stringify(
    {
      images: [
        { idiom: "universal", filename: "Splash-2732.png", scale: "1x" },
        { idiom: "universal", filename: "Splash-2732.png", scale: "2x" },
        { idiom: "universal", filename: "Splash-2732.png", scale: "3x" },
      ],
      info: { author: "daybreak", version: 1 },
    },
    null,
    2
  ) + "\n"
);

console.log("Generated native iOS AppIcon and launch assets from Daybreak source artwork.");
