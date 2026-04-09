// ============================================================
// Google Gemini Flash Image Generation
//
// Paid tier, ~$0.06/day for 500 images
// ~6s per image, 1024x1024, highest quality
// ============================================================

import { coolDown, markExhausted } from "./rate-limiter";
import { tryUse } from "./cost-guard";
import { pickPrompt, cameraStyle, NEGATIVE_PROMPT } from "./ai-prompts";
import type { GeneratedImage } from "./ai-generators";

const MODEL = "gemini-2.5-flash-image";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export async function generateWithGemini(
  apiKey: string | undefined,
  category: string
): Promise<GeneratedImage | null> {
  if (!apiKey || !tryUse("gemini")) return null;

  const prompt = pickPrompt(category);
  if (!prompt) return null;

  const fullPrompt = `Generate a photorealistic photograph: ${prompt}, ${cameraStyle()}, RAW photo, sharp detail, film grain, natural texture. Do not include: ${NEGATIVE_PROMPT}`;

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
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
        signal: AbortSignal.timeout(30_000),
      }
    );

    if (response.status === 429) {
      console.log("[AI-Gen] Gemini rate limited");
      coolDown("gemini", 60_000);
      return null;
    }

    if (response.status === 402 || response.status === 403) {
      console.log("[AI-Gen] Gemini quota/billing issue");
      markExhausted("gemini");
      return null;
    }

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

    // Find the image part
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

        return { data, model: "gemini-flash", prompt };
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
