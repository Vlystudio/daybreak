import "server-only";
import { openaiClient, logUsage } from "@/lib/integrations/openai";
import type { BirdPalette } from "@/lib/game/birds";

/**
 * Identify a real bird from a photo via OpenAI vision, returning a common name,
 * a short fun fact, and the colors/shape needed to render it as an original
 * collectible sprite. Images are processed transiently and never stored.
 */

export interface BirdIdentification {
  isBird: boolean;
  name: string;
  blurb: string;
  palette: BirdPalette;
  crest: boolean;
  longTail: boolean;
  confidence: number | null;
}

const FALLBACK: BirdPalette = { body: "#8a7a66", belly: "#efe6d6", wing: "#5f5141", beak: "#3a342e", cheek: "#d8c4a8" };

function hex(v: unknown, fallback: string): string {
  return typeof v === "string" && /^#?[0-9a-fA-F]{6}$/.test(v.trim()) ? (v.trim().startsWith("#") ? v.trim() : `#${v.trim()}`) : fallback;
}

const PROMPT = `You identify birds from photos for a friendly bird-collecting game. Look at the image and respond with JSON exactly:
{"isBird": boolean, "name": "common species name", "blurb": "one cheerful sentence fun fact", "palette": {"body": "#hex", "belly": "#hex", "wing": "#hex", "beak": "#hex", "cheek": "#hex"}, "crest": boolean, "longTail": boolean, "confidence": number 0..1}
Pick the palette hex colors from the bird's actual plumage so a cartoon of it would resemble it. If the image is not a bird, set isBird false and use any values.`;

export async function identifyBird(dataUrl: string): Promise<BirdIdentification | null> {
  if (!/^data:image\//.test(dataUrl)) return null;

  const client = openaiClient();
  if (!client) return null;
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "What bird is this?" },
            { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
          ],
        },
      ],
    });
    logUsage("bird-identify", completion.usage);
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;
    const p = JSON.parse(raw) as Record<string, unknown>;
    const pal = (p.palette ?? {}) as Record<string, unknown>;
    return {
      isBird: p.isBird !== false,
      name: typeof p.name === "string" ? p.name.slice(0, 80) : "Mystery bird",
      blurb: typeof p.blurb === "string" ? p.blurb.slice(0, 300) : "A bird you spotted in the wild.",
      palette: {
        body: hex(pal.body, FALLBACK.body),
        belly: hex(pal.belly, FALLBACK.belly),
        wing: hex(pal.wing, FALLBACK.wing),
        beak: hex(pal.beak, FALLBACK.beak),
        cheek: hex(pal.cheek, FALLBACK.cheek),
      },
      crest: p.crest === true,
      longTail: p.longTail === true,
      confidence: typeof p.confidence === "number" ? Math.round(p.confidence * 100) / 100 : null,
    };
  } catch (err) {
    console.error("[bird-identify] failed:", err instanceof Error ? err.message : "unknown");
    return null;
  }
}
