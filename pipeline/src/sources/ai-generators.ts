// ============================================================
// AI Image Generation Sources (all free)
//
// 1. Cloudflare Workers AI (Flux Schnell)
// 2. Pollinations.ai
// 3. Hugging Face Inference API (FLUX.1-schnell, SD3 Medium)
// ============================================================

import { isCoolingDown, coolDown, markExhausted } from "./rate-limiter";
import { pickPrompt, cameraStyle, NEGATIVE_PROMPT } from "./ai-prompts";
export { randomCategory } from "./ai-prompts";

export interface GeneratedImage {
  data: ArrayBuffer;
  model: string;
  prompt: string;
}

/**
 * Pollinations.ai - free, no key needed.
 */
export async function generateWithPollinations(
  category: string
): Promise<GeneratedImage | null> {
  // cooldown checked by caller (runAiBatch)

  const prompt = pickPrompt(category);
  if (!prompt) return null;

  const fullPrompt = `${prompt}, ${cameraStyle()}, photorealistic, RAW photo`;
  const encodedPrompt = encodeURIComponent(fullPrompt);
  const encodedNegative = encodeURIComponent(NEGATIVE_PROMPT);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${Date.now()}&negative=${encodedNegative}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "image/jpeg" },
      signal: AbortSignal.timeout(120_000),
    });

    if (response.status === 429) {
      coolDown("pollinations");
      return null;
    }

    if (!response.ok) {
      console.log(`[AI-Gen] Pollinations ${response.status}`);
      return null;
    }

    const data = await response.arrayBuffer();
    if (data.byteLength < 10000) {
      console.log(`[AI-Gen] Pollinations response too small (${data.byteLength} bytes)`);
      return null;
    }

    return { data, model: "pollinations-flux", prompt };
  } catch (err) {
    console.log(`[AI-Gen] Pollinations failed: ${err}`);
    coolDown("pollinations");
    return null;
  }
}

/**
 * Cloudflare Workers AI - free tier, env.AI binding.
 */
export async function generateWithWorkersAI(
  ai: unknown,
  category: string
): Promise<GeneratedImage | null> {
  if (!ai) {
    console.log("[AI-Gen] Workers AI binding is falsy, skipping");
    return null;
  }

  const prompt = pickPrompt(category);
  if (!prompt) return null;

  try {
    const aiBinding = ai as {
      run(
        model: string,
        input: Record<string, unknown>
      ): Promise<ReadableStream | ArrayBuffer | Uint8Array>;
    };

    const result = await aiBinding.run(
      "@cf/black-forest-labs/flux-1-schnell",
      {
        prompt: `${prompt}, ${cameraStyle()}, photorealistic, RAW photo, sharp detail`,
        num_steps: 8,
        width: 768,
        height: 768,
      }
    );

    let data: ArrayBuffer;
    if (result instanceof ReadableStream) {
      const reader = result.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      data = combined.buffer as ArrayBuffer;
    } else if (result instanceof Uint8Array) {
      data = result.buffer as ArrayBuffer;
    } else {
      data = result as ArrayBuffer;
    }

    if (data.byteLength < 5000) {
      console.log(`[AI-Gen] Workers AI response too small: ${data.byteLength} bytes`);
      return null;
    }

    return { data, model: "flux-1-schnell", prompt };
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

/**
 * Hugging Face Inference API - free tier.
 */
export async function generateWithHuggingFace(
  hfToken: string | undefined,
  category: string
): Promise<GeneratedImage | null> {
  if (!hfToken) return null;

  const prompt = pickPrompt(category);
  if (!prompt) return null;

  const models = [
    "black-forest-labs/FLUX.1-schnell",
    "stabilityai/stable-diffusion-3-medium-diffusers",
  ];
  const model = models[Math.floor(Math.random() * models.length)];

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
          inputs: `${prompt}, ${cameraStyle()}, photorealistic, RAW photo, sharp detail`,
          parameters: {
            num_inference_steps: 8,
            width: 1024,
            height: 1024,
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

    if (response.status === 429) {
      coolDown("huggingface");
      return null;
    }

    if (response.status === 503) {
      coolDown("huggingface", 30_000);
      return null;
    }

    if (!response.ok) {
      const text = await response.text();
      console.log(`[AI-Gen] HuggingFace ${response.status} for ${model}: ${text.slice(0, 100)}`);
      return null;
    }

    const data = await response.arrayBuffer();
    if (data.byteLength < 5000) return null;

    return {
      data,
      model: `hf-${model.split("/").pop()}`,
      prompt,
    };
  } catch (err) {
    console.log(`[AI-Gen] HuggingFace failed: ${err}`);
    coolDown("huggingface");
    return null;
  }
}
