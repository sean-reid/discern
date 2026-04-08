// ============================================================
// AI Image Generation Sources (all free)
//
// 1. Cloudflare Workers AI (Flux Schnell)
//    - Free tier included with Workers
//    - Called via env.AI binding, no external API key
//
// 2. Pollinations.ai
//    - Completely free, no API key, no signup
//    - Just an HTTP GET with the prompt in the URL
//
// 3. Hugging Face Inference API
//    - Free tier, needs HF_TOKEN
//    - FLUX.1-schnell, SD3 Medium
// ============================================================

import { isCoolingDown, coolDown, markExhausted } from "./rate-limiter";

interface GeneratedImage {
  data: ArrayBuffer;
  model: string;
  prompt: string;
}

// Camera and lens combos to make AI images mimic real photography
const CAMERA_STYLES = [
  "shot on Canon EOS R5, 85mm f/1.4, natural lighting",
  "shot on Sony A7IV, 35mm f/1.8, available light",
  "shot on Fujifilm X-T5, 56mm f/1.2, film simulation",
  "shot on Nikon Z8, 50mm f/1.2, soft ambient light",
  "Leica Q2, 28mm f/1.7, natural tones",
  "iPhone 15 Pro, 24mm, computational photography",
  "Hasselblad X2D, 80mm f/1.9, medium format look",
];

const NEGATIVE_PROMPT = "blurry, low quality, distorted, watermark, text, logo, cartoon, illustration, painting, drawing, render, CGI, plastic skin, extra fingers, deformed";

function cameraStyle(): string {
  return CAMERA_STYLES[Math.floor(Math.random() * CAMERA_STYLES.length)];
}

const PROMPTS: Record<string, string[]> = {
  people: [
    "professional headshot of a 40-year-old man in a navy blazer, soft window light, shallow depth of field, slightly off-center composition",
    "candid street portrait of a young woman walking through a European city, overcast day, 35mm film grain, looking away from camera",
    "environmental portrait of a carpenter in their workshop, sawdust in the air, warm tungsten light, medium shot",
    "elderly woman with silver hair sitting in a garden, reading glasses, dappled sunlight through leaves",
    "group of coworkers having coffee outside an office building, natural expressions, mid-conversation",
    "teenager skateboarding in a concrete park, frozen mid-trick, late afternoon backlight",
    "chef preparing food in a professional kitchen, motion blur on hands, sharp face, overhead fluorescent light",
  ],
  landscapes: [
    "misty valley at dawn, layers of fog between forested ridges, Appalachian mountains, no sky visible",
    "rocky coastline at low tide, tide pools in foreground, overcast sky, long exposure smoothed waves",
    "single dirt road cutting through golden wheat fields, flat horizon, cumulus clouds, Midwest USA",
    "dense moss-covered forest floor, fallen logs, Pacific Northwest rainforest, diffused overcast light",
    "frozen lake at twilight, cracked ice patterns, distant snow-capped peaks reflected, Iceland",
    "terraced rice paddies filled with water reflecting sunset, Bali, aerial perspective",
    "desert canyon with layered red sandstone walls, narrow slot canyon, beam of light from above",
  ],
  animals: [
    "red fox standing in fresh snow, breath visible, early morning light, forest edge background",
    "barn owl perched on a weathered fence post, soft bokeh background, overcast day",
    "sea otter floating on its back in kelp, Monterey Bay, eye-level water shot",
    "border collie mid-leap catching a frisbee, frozen motion, park setting, shallow depth of field",
    "monarch butterfly on a milkweed plant, macro shot, morning dew visible on wings",
    "humpback whale breaching, water droplets frozen mid-air, overcast ocean, telephoto compression",
    "tabby cat curled up on a worn leather armchair, afternoon sunbeam, dust motes visible",
  ],
  food: [
    "sourdough loaf with deep ear scoring on a wire cooling rack, rustic wooden counter, flour dusted, side lighting",
    "steaming bowl of tonkotsu ramen, soft-boiled egg halved, chashu pork, chopsticks resting on bowl edge, overhead shot",
    "molten chocolate fondant on a white plate, powdered sugar dusted, raspberry coulis swoosh, restaurant plating",
    "hand-rolled sushi on a hinoki wood board, ginger and wasabi, natural daylight from left, 45-degree angle",
    "stack of blueberry pancakes with melting butter pat, syrup mid-pour, diner setting, warm light",
    "wood-fired margherita pizza on a peel, charred crust bubbles, San Marzano tomatoes visible, steam rising",
    "farmers market display of heirloom tomatoes, various colors and sizes, morning sun, overhead perspective",
  ],
  architecture: [
    "brutalist concrete apartment block, geometric repeating balconies, flat overcast sky, shot from street level",
    "gothic cathedral nave interior, ribbed vaults, late afternoon light through rose window, no people",
    "modern glass office tower reflecting sunset clouds, shot from below with converging verticals",
    "narrow cobblestone alley in Lisbon, azulejo tile facades, hanging laundry, warm afternoon light",
    "abandoned textile mill, broken windows, vines growing through brick, moody overcast, wide angle",
    "traditional Japanese machiya townhouse, wooden lattice facade, Kyoto backstreet, diffused light",
    "art deco cinema entrance, neon marquee, terrazzo floor, evening blue hour, symmetrical composition",
  ],
  art: [
    "oil painting of a stormy North Sea in an ornate gilded frame, gallery wall with spot lighting",
    "large Cor-Ten steel sculpture in a sculpture garden, autumn trees background, overcast sky",
    "vibrant street mural covering a three-story brick wall, spray paint texture visible, urban setting",
    "potter's wheel with wet clay being shaped, hands in frame, studio with natural skylight",
    "charcoal life drawing pinned to a studio wall, graphite smudges, artist's tools on table below",
    "medieval stained glass window detail, lead came visible, backlit by overcast sky, interior view",
    "printmaker pulling an etching from a press, ink on hands, workshop with hanging prints drying",
  ],
  street: [
    "rain-slicked city street at night, neon signs reflecting in puddles, lone pedestrian with umbrella, Tokyo",
    "Shibuya crossing from above, rush hour, motion blur on pedestrians, sharp buildings, overcast",
    "busker playing upright bass on a Paris metro platform, motion blur of passing train, warm tungsten",
    "1960s muscle car parked on an empty desert highway, heat shimmer, vanishing point composition",
    "spice market stall with pyramids of colorful powder, vendor weighing on brass scale, Istanbul",
    "cyclist splashing through a puddle on a cobblestone street, frozen water droplets, Amsterdam",
    "food cart with steam rising, night market, string lights overhead, customers waiting, Taipei",
  ],
};

function pickPrompt(category: string): string | null {
  const prompts = PROMPTS[category];
  if (!prompts) return null;
  return prompts[Math.floor(Math.random() * prompts.length)];
}

/**
 * Pollinations.ai - free, no key needed.
 */
export async function generateWithPollinations(
  category: string
): Promise<GeneratedImage | null> {
  if (isCoolingDown("pollinations")) return null;

  const prompt = pickPrompt(category);
  if (!prompt) return null;

  const fullPrompt = `${prompt}, ${cameraStyle()}, photorealistic, RAW photo`;
  const encodedPrompt = encodeURIComponent(fullPrompt);
  const encodedNegative = encodeURIComponent(NEGATIVE_PROMPT);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${Date.now()}&negative=${encodedNegative}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "image/jpeg" },
      signal: AbortSignal.timeout(30_000),
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
  if (!ai || isCoolingDown("workers-ai")) return null;

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
        width: 1024,
        height: 1024,
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

    if (data.byteLength < 5000) return null;

    return { data, model: "flux-1-schnell", prompt };
  } catch (err) {
    const msg = String(err);
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
  if (!hfToken || isCoolingDown("huggingface")) return null;

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
      console.log("[AI-Gen] HuggingFace monthly credits depleted, disabling");
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
      if (response.status === 410) {
        // Model deprecated, don't cool down the whole source
        console.log(`[AI-Gen] Model ${model} deprecated, will try another next time`);
      }
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

export function randomCategory(): string {
  const cats = Object.keys(PROMPTS);
  return cats[Math.floor(Math.random() * cats.length)];
}
