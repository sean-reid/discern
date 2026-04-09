import { coolDown, markExhausted } from "./rate-limiter";
import { tryUse } from "./cost-guard";
import { buildPrompt, NEGATIVE_PROMPT, type GeneratedImage } from "./ai-prompts";

const MODEL = "gemini-2.5-flash-image";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export async function generateWithGemini(
  apiKey: string | undefined,
  category: string
): Promise<GeneratedImage | null> {
  if (!apiKey || !tryUse("gemini")) return null;

  const p = buildPrompt(category);
  if (!p) return null;

  const fullPrompt = `Generate a photorealistic photograph: ${p.full}, film grain, natural texture. Do not include: ${NEGATIVE_PROMPT}`;

  try {
    const response = await fetch(
      `${API_BASE}/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
        signal: AbortSignal.timeout(30_000),
      }
    );

    if (response.status === 429) { coolDown("gemini", 60_000); return null; }
    if (response.status === 402 || response.status === 403) { markExhausted("gemini"); return null; }

    if (!response.ok) {
      const text = await response.text();
      console.log(`[AI-Gen] Gemini ${response.status}: ${text.slice(0, 150)}`);
      coolDown("gemini");
      return null;
    }

    const result = await response.json() as {
      candidates?: Array<{
        content: {
          parts: Array<{
            text?: string;
            inlineData?: { data: string; mimeType: string };
          }>;
        };
      }>;
    };

    const parts = result.candidates?.[0]?.content?.parts;
    if (!parts) {
      console.log("[AI-Gen] Gemini returned no candidates");
      return null;
    }

    for (const part of parts) {
      if (part.inlineData?.data) {
        const binaryString = atob(part.inlineData.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const data = bytes.buffer as ArrayBuffer;

        if (data.byteLength < 5000) {
          console.log(`[AI-Gen] Gemini image too small: ${data.byteLength} bytes`);
          return null;
        }

        return { data, model: "gemini-flash", prompt: p.raw };
      }
    }

    console.log("[AI-Gen] Gemini response had no image part");
    return null;
  } catch (err) {
    console.log(`[AI-Gen] Gemini failed: ${err}`);
    coolDown("gemini");
    return null;
  }
}
