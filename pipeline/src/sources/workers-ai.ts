import { coolDown, markExhausted } from "./rate-limiter";
import { buildPrompt, TEXTURE_BOOST, type GeneratedImage } from "./ai-prompts";

export async function generateWithWorkersAI(
  ai: unknown,
  category: string
): Promise<GeneratedImage | null> {
  if (!ai) return null;

  const p = buildPrompt(category);
  if (!p) return null;

  try {
    const aiBinding = ai as {
      run(model: string, input: Record<string, unknown>): Promise<unknown>;
    };

    const result = await aiBinding.run("@cf/black-forest-labs/flux-1-schnell", {
      prompt: `${p.full}, ${TEXTURE_BOOST}`,
      steps: 8,
    });

    const response = result as { image?: string };
    if (!response.image) {
      console.log("[AI-Gen] Workers AI returned no image field");
      return null;
    }

    const binaryString = atob(response.image);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const data = bytes.buffer as ArrayBuffer;

    if (data.byteLength < 5000) {
      console.log(`[AI-Gen] Workers AI image too small: ${data.byteLength} bytes`);
      return null;
    }

    return { data, model: "flux-1-schnell", prompt: p.raw };
  } catch (err) {
    const msg = String(err);
    console.log(`[AI-Gen] Workers AI error: ${msg}`);
    if (msg.includes("4006") || msg.includes("daily free allocation")) {
      markExhausted("workers-ai");
    } else {
      coolDown("workers-ai");
    }
    return null;
  }
}
