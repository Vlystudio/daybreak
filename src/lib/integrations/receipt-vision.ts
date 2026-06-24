import "server-only";
import { openaiClient, logUsage } from "@/lib/integrations/openai";

/**
 * Grocery receipt OCR → structured purchase via OpenAI vision. Returns the
 * store, date, total, and line items. Images are processed transiently and
 * never stored. No-ops when OpenAI isn't configured.
 */

export interface ReceiptItem {
  name: string;
  price: number | null;
}

export interface ReceiptAnalysis {
  store: string | null;
  date: string | null; // YYYY-MM-DD if found
  total: number | null;
  items: ReceiptItem[];
}

const PROMPT = `You read grocery receipts. Extract the store name, the purchase date (YYYY-MM-DD if visible), the grand total, and the line items (name + price each).
Respond with JSON exactly: {"store": string|null, "date": "YYYY-MM-DD"|null, "total": number|null, "items": [{"name": string, "price": number|null}]}.
Use the printed grand total for "total" (after discounts, before/with tax as printed). Skip non-item lines (subtotal, tax, change). If it isn't a receipt, return all nulls and an empty items array.`;

export async function analyzeReceipt(dataUrl: string): Promise<ReceiptAnalysis | null> {
  if (!/^data:image\//.test(dataUrl)) return null;

  const client = openaiClient();
  if (!client) return null;
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 1500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract this grocery receipt." },
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
          ],
        },
      ],
    });
    logUsage("receipt-vision", completion.usage);
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;
    const p = JSON.parse(raw) as Record<string, unknown>;
    const items = Array.isArray(p.items)
      ? (p.items as Record<string, unknown>[])
          .map((it) => ({
            name: typeof it.name === "string" ? it.name.slice(0, 120) : "",
            price: typeof it.price === "number" && isFinite(it.price) ? Math.round(it.price * 100) / 100 : null,
          }))
          .filter((it) => it.name.length > 0)
          .slice(0, 200)
      : [];
    const dateStr = typeof p.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : null;
    return {
      store: typeof p.store === "string" ? p.store.slice(0, 120) : null,
      date: dateStr,
      total: typeof p.total === "number" && isFinite(p.total) ? Math.round(p.total * 100) / 100 : null,
      items,
    };
  } catch (err) {
    console.error("[receipt-vision] failed:", err instanceof Error ? err.message : "unknown");
    return null;
  }
}
