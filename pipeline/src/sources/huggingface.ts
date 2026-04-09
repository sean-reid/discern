import { coolDown, markExhausted } from "./rate-limiter";
import { tryUse } from "./cost-guard";
import { buildPrompt, NEGATIVE_PROMPT, TEXTURE_BOOST, type GeneratedImage } from "./ai-prompts";

const MODELS = [
  "black-forest-labs/FLUX.1-schnell",
  "stabilityai/stable-diffusion-3-medium-diffusers",
];

function isFlux(model: string): boolean {
  return model.includes("FLUX");
}

export async function generateWithHuggingFace(
  hfToken: string | undefined,
  category: string
): Promise<GeneratedImage | null> {
  if (!hfToken || !tryUse("huggingface")) return null;

  const p = buildPrompt(category);
  if (!p) return null;

  const model = MODELS[Math.floor(Math.random() * MODELS.length)];
  const prompt = isFlux(model) ? `${p.full}, ${TEXTURE_BOOST}` : p.full;

  try {
    const response = await fetch(
      `https://router.huggingface.co/hf-inference/models/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            num_inference_steps: isFlux(model) ? 8 : 20,
            width: 1024,
            height: 1024,
            ...(!isFlux(model) ? { negative_prompt: NEGATIVE_PROMPT } : {}),
          },
        }),
        signal: AbortSignal.timeout(30_000),
      }
    );

    if (response.status === 402) {
      console.log("[AI-Gen] HuggingFace credits depleted");
      markExhausted("huggingface");
      return null;
    }

    if (response.status === 429) { coolDown("huggingface"); return null; }
    if (response.status === 503) { coolDown("huggingface", 30_000); return null; }

    if (!response.ok) {
      const text = await response.text();
      console.log(`[AI-Gen] HuggingFace ${response.status} for ${model}: ${text.slice(0, 100)}`);
      return null;
    }

    const data = await response.arrayBuffer();
    if (data.byteLength < 5000) return null;

    return { data, model: `hf-${model.split("/").pop()}`, prompt: p.raw };
  } catch (err) {
    console.log(`[AI-Gen] HuggingFace failed: ${err}`);
    coolDown("huggingface");
    return null;
  }
}
