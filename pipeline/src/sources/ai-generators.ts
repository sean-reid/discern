// ============================================================
// AI Image Generation Sources (all free)
//
// 1. Cloudflare Workers AI (Flux Schnell / Stable Diffusion XL)
//    - Free tier included with Workers
//    - Called via env.AI binding, no external API key
//
// 2. Pollinations.ai
//    - Completely free, no API key, no signup
//    - Just an HTTP GET with the prompt in the URL
//
// 3. Hugging Face Inference API
//    - Free tier, needs HF_TOKEN
//    - Stable Diffusion XL, Flux, etc.
// ============================================================

interface GeneratedImage {
  data: ArrayBuffer;
  model: string;
  prompt: string;
}

// Prompt templates per category. Each has several variants to prevent repetition.
const PROMPTS: Record<string, string[]> = {
  people: [
    "professional headshot of a person in natural lighting, shallow depth of field",
    "candid street portrait of someone walking through a city, shot on 35mm film",
    "close-up portrait with soft window light, neutral background",
    "person sitting at a cafe reading a book, warm afternoon light",
    "group of friends laughing together at a park, natural expressions",
    "elderly person with weathered hands, black and white portrait",
    "child playing in a field during golden hour, backlit",
  ],
  landscapes: [
    "misty mountain valley at sunrise, layers of fog between peaks",
    "rocky coastline with crashing waves, long exposure smooth water",
    "autumn forest path with red and orange leaves covering the ground",
    "desert sand dunes at sunset with dramatic shadows",
    "frozen lake reflecting snow-covered mountains, Iceland",
    "rolling hills of green farmland under storm clouds",
    "tropical waterfall surrounded by dense jungle vegetation",
  ],
  animals: [
    "red fox in a snowy forest, looking directly at camera",
    "close-up of a barn owl in flight at dusk",
    "sea turtle swimming through crystal clear ocean water",
    "golden retriever running through a field, ears flapping",
    "monarch butterfly resting on a purple wildflower, macro shot",
    "wild horses galloping along a beach at sunset",
    "tabby cat sitting on a windowsill watching rain",
  ],
  food: [
    "artisan sourdough bread sliced on a wooden cutting board, rustic kitchen",
    "bowl of fresh ramen with egg, nori and scallions, steam rising",
    "chocolate lava cake with a molten center, plated elegantly",
    "fresh sushi platter on a dark slate plate, overhead shot",
    "stack of fluffy pancakes with berries and maple syrup dripping",
    "homemade pizza fresh from a wood-fired oven, cheese bubbling",
    "colorful poke bowl with salmon, avocado and edamame",
  ],
  architecture: [
    "brutalist concrete building with geometric shadows, overcast sky",
    "ornate cathedral interior with stained glass windows, light streaming in",
    "modern glass skyscraper reflecting clouds, shot from below",
    "narrow cobblestone alley in an old European town, laundry hanging",
    "abandoned factory with broken windows and overgrown plants",
    "Japanese temple surrounded by cherry blossom trees",
    "art deco building facade with gold and teal details",
  ],
  art: [
    "oil painting of a stormy seascape in a gilded frame",
    "abstract sculpture in a white gallery space, dramatic spotlighting",
    "graffiti mural on a brick wall, vibrant colors, urban setting",
    "ceramic pottery collection on wooden shelves, earth tones",
    "large scale charcoal drawing of a human figure, art studio",
    "stained glass window with geometric patterns, backlit by sun",
    "watercolor painting of wildflowers, loose brushstrokes",
  ],
  street: [
    "rainy city street at night with neon reflections on wet pavement",
    "busy crosswalk in Tokyo with motion blur, overhead shot",
    "street musician playing guitar on a quiet corner, warm light",
    "vintage car parked on an empty road in a small town",
    "market stall overflowing with colorful spices, vendor in background",
    "cyclist riding through a puddle, water splashing, frozen motion",
    "steam rising from a manhole cover on a cold morning, city sidewalk",
  ],
};

/**
 * Generate an image using Pollinations.ai (free, no key needed).
 * Simply fetches an image from their URL-based API.
 */
export async function generateWithPollinations(
  category: string
): Promise<GeneratedImage | null> {
  const categoryPrompts = PROMPTS[category];
  if (!categoryPrompts) return null;

  const prompt =
    categoryPrompts[Math.floor(Math.random() * categoryPrompts.length)];

  // Pollinations generates on the fly from the URL
  const encodedPrompt = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1200&height=900&nologo=true&seed=${Date.now()}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "image/jpeg" },
    });

    if (!response.ok) {
      console.log(
        `[AI-Gen] Pollinations returned ${response.status} for "${prompt}"`
      );
      return null;
    }

    const data = await response.arrayBuffer();

    // Basic sanity check: should be at least 10KB for a real image
    if (data.byteLength < 10000) {
      console.log(`[AI-Gen] Pollinations response too small (${data.byteLength} bytes)`);
      return null;
    }

    return {
      data,
      model: "pollinations-flux",
      prompt,
    };
  } catch (err) {
    console.error(`[AI-Gen] Pollinations error: ${err}`);
    return null;
  }
}

/**
 * Generate an image using Cloudflare Workers AI.
 * Uses the AI binding available in the Worker environment.
 * Falls back gracefully if the binding isn't configured.
 */
export async function generateWithWorkersAI(
  ai: unknown,
  category: string
): Promise<GeneratedImage | null> {
  if (!ai) return null;

  const categoryPrompts = PROMPTS[category];
  if (!categoryPrompts) return null;

  const prompt =
    categoryPrompts[Math.floor(Math.random() * categoryPrompts.length)];

  try {
    // The AI binding exposes a run() method
    // @cf/black-forest-labs/flux-1-schnell is fast and free
    // @cf/stabilityai/stable-diffusion-xl-base-1.0 is also available
    const aiBinding = ai as {
      run(
        model: string,
        input: Record<string, unknown>
      ): Promise<ReadableStream | ArrayBuffer | Uint8Array>;
    };

    const result = await aiBinding.run(
      "@cf/black-forest-labs/flux-1-schnell",
      {
        prompt: `${prompt}, photorealistic, 8k, shot on Canon EOS R5`,
        num_steps: 4,
      }
    );

    // Result is typically a ReadableStream or Uint8Array of the PNG
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
      console.log(`[AI-Gen] Workers AI response too small (${data.byteLength} bytes)`);
      return null;
    }

    return {
      data,
      model: "flux-1-schnell",
      prompt,
    };
  } catch (err) {
    console.error(`[AI-Gen] Workers AI error: ${err}`);
    return null;
  }
}

/**
 * Generate an image using Hugging Face Inference API (free tier).
 * Uses Stable Diffusion XL or Flux models.
 */
export async function generateWithHuggingFace(
  hfToken: string | undefined,
  category: string
): Promise<GeneratedImage | null> {
  if (!hfToken) return null;

  const categoryPrompts = PROMPTS[category];
  if (!categoryPrompts) return null;

  const prompt =
    categoryPrompts[Math.floor(Math.random() * categoryPrompts.length)];

  // Rotate between models for diversity
  const models = [
    "stabilityai/stable-diffusion-xl-base-1.0",
    "black-forest-labs/FLUX.1-schnell",
  ];
  const model = models[Math.floor(Math.random() * models.length)];

  try {
    const response = await fetch(
      `https://router.huggingface.co/models/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: `${prompt}, photorealistic, high quality`,
          parameters: {
            num_inference_steps: 4,
          },
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.log(
        `[AI-Gen] HuggingFace ${response.status} for ${model}: ${text.slice(0, 200)}`
      );
      return null;
    }

    const data = await response.arrayBuffer();

    if (data.byteLength < 5000) {
      console.log(
        `[AI-Gen] HuggingFace response too small (${data.byteLength} bytes)`
      );
      return null;
    }

    return {
      data,
      model: `hf-${model.split("/").pop()}`,
      prompt,
    };
  } catch (err) {
    console.error(`[AI-Gen] HuggingFace error: ${err}`);
    return null;
  }
}

/**
 * Get a random category slug.
 */
export function randomCategory(): string {
  const cats = Object.keys(PROMPTS);
  return cats[Math.floor(Math.random() * cats.length)];
}
