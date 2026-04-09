// Camera/lens combos to mimic real photography metadata
export const CAMERA_STYLES = [
  "shot on Canon EOS R5, 85mm f/1.4, natural lighting",
  "shot on Canon 5D Mark IV, 50mm f/1.2, ambient light",
  "shot on Canon EOS R6 II, 24-70mm f/2.8, mixed lighting",
  "shot on Sony A7IV, 35mm f/1.8, available light",
  "shot on Sony A7R V, 90mm f/2.8 macro, diffused light",
  "shot on Sony A6700, 18-135mm, outdoor natural light",
  "shot on Fujifilm X-T5, 56mm f/1.2, classic chrome simulation",
  "shot on Fujifilm X100VI, 23mm f/2, grain effect",
  "shot on Fujifilm GFX 100S, 80mm f/1.7, medium format",
  "shot on Nikon Z8, 50mm f/1.2, soft ambient light",
  "shot on Nikon Z6 III, 24-120mm f/4, overcast daylight",
  "shot on Nikon D850, 70-200mm f/2.8, telephoto compression",
  "Leica Q2, 28mm f/1.7, natural tones",
  "Leica M11, 50mm Summilux, rangefinder rendering",
  "iPhone 15 Pro, 24mm, ProRAW, computational HDR",
  "iPhone 16 Pro Max, 48mm, portrait mode, natural light",
  "Samsung Galaxy S24 Ultra, 200mm telephoto, AI enhanced",
  "Hasselblad X2D, 80mm f/1.9, medium format look",
  "Olympus OM-1, 45mm f/1.2, micro four thirds",
  "Pentax K-3 III, 77mm f/1.8 limited, warm color science",
  "Ricoh GR IIIx, 40mm f/2.8, snap aesthetic",
  "Panasonic S5 II, 50mm f/1.8, smooth video-like rendering",
];

export const NEGATIVE_PROMPT = "blurry, low quality, distorted, watermark, text, logo, cartoon, illustration, painting, drawing, render, CGI, plastic skin, extra fingers, deformed, artificial, fake looking";

export const PROMPTS: Record<string, string[]> = {
  people: [
    // Headshots and portraits
    "professional headshot of a 40-year-old man in a navy blazer, soft window light, shallow depth of field, slightly off-center composition",
    "close-up portrait of a woman in her 30s with freckles, early morning golden hour, hair slightly windblown, genuine smile",
    "corporate headshot of a South Asian man in a charcoal suit, clean white background, studio strobe with softbox, crisp detail",
    "editorial portrait of an older Black woman with silver locs, dignified expression, dramatic Rembrandt lighting, dark background",
    "passport-style photo of a college student, neutral expression, flat flash, white wall behind, slightly awkward pose",
    // Environmental and candid
    "candid street portrait of a young woman walking through a European city, overcast day, 35mm film grain, looking away from camera",
    "environmental portrait of a carpenter in their workshop, sawdust in the air, warm tungsten light, medium shot",
    "elderly woman with silver hair sitting in a garden, reading glasses, dappled sunlight through leaves, content expression",
    "barista pulling espresso behind a counter, steam catching light, shallow depth of field, coffee shop interior",
    "farmer standing in front of a red barn at dawn, work boots, flannel shirt, hands on hips, mist in background",
    "nurse in scrubs taking a break outside a hospital, tired but kind eyes, overcast sky, candid moment",
    "fisherman mending nets at a dock, weathered hands, early morning light reflecting off water, tight crop",
    // Groups and action
    "group of coworkers having coffee outside an office building, natural expressions, mid-conversation, urban setting",
    "teenager skateboarding in a concrete park, frozen mid-trick, late afternoon backlight, motion blur on wheels",
    "chef preparing food in a professional kitchen, motion blur on hands, sharp face, overhead fluorescent light",
    "two friends laughing on a park bench, autumn leaves on ground, warm afternoon light, genuine moment",
    "street busker playing violin in a subway station, commuters blurred in background, overhead fluorescent mix with daylight",
    "children running through sprinklers in a backyard, frozen water droplets, summer afternoon, joy on faces",
    "yoga class in a sunlit studio, instructor demonstrating pose, mirrors reflecting natural light, peaceful atmosphere",
    "wedding guests on a dance floor, motion blur, colorful ambient lighting, candid celebration",
    // Diverse and specific
    "Indigenous elder with traditional jewelry, environmental portrait, desert landscape background, late afternoon sidelight",
    "Japanese grandmother making tea in a traditional room, tatami mats, soft window light, serene composition",
    "construction worker eating lunch on a steel beam, hard hat beside them, urban skyline background, midday sun",
    "librarian shelving books in an old library, dust motes in light beam from window, warm wood tones",
    "tattoo artist at work, close-up of gloved hands, buzzing machine, intense concentration, studio lighting",
  ],
  landscapes: [
    // Mountains and valleys
    "misty valley at dawn, layers of fog between forested ridges, Appalachian mountains, no sky visible",
    "jagged alpine peaks with fresh snow, dramatic cloud shadows sweeping across the face, Dolomites, early morning",
    "volcanic crater lake with emerald water, steam vents on the rim, overcast sky, wide angle, New Zealand",
    "rolling green hills dotted with sheep, stone walls dividing pastures, Lake District England, soft overcast",
    "mountain meadow with wildflowers in bloom, snow-capped peaks behind, Colorado Rockies, golden hour",
    // Water and coast
    "rocky coastline at low tide, tide pools in foreground, overcast sky, long exposure smoothed waves",
    "turquoise glacial river winding through black volcanic sand, Iceland aerial perspective, overcast",
    "mangrove roots at low tide, reflection in still water, tropical humidity haze, Florida Keys",
    "dramatic cliff face meeting the ocean, seabirds in flight, stormy sky, Cliffs of Moher, Ireland",
    "frozen waterfall with blue ice formations, long icicles, winter forest background, Minnesota",
    "calm lake at sunrise, perfect mirror reflection, lone canoe at dock, Boundary Waters, mist rising",
    // Desert and plains
    "single dirt road cutting through golden wheat fields, flat horizon, cumulus clouds, Midwest USA",
    "desert canyon with layered red sandstone walls, narrow slot canyon, beam of light from above, Antelope Canyon",
    "cracked dry lakebed stretching to mountains, heat shimmer, Alvord Desert Oregon, late afternoon",
    "sand dunes at blue hour with star trails beginning, Sahara, single set of footprints leading away",
    "vast sunflower field at peak bloom, farmhouse in distance, Kansas, golden afternoon light",
    // Forest and jungle
    "dense moss-covered forest floor, fallen logs, Pacific Northwest rainforest, diffused overcast light",
    "bamboo grove with light filtering through, path winding between stalks, Arashiyama Kyoto, morning mist",
    "autumn forest canopy from below, looking straight up, red and orange leaves backlit by sun, Vermont",
    "ancient sequoia trunk filling the frame, person at base for scale, forest cathedral light, California",
    "birch forest in winter, white trunks against fresh snow, minimal composition, soft grey sky, Finland",
    // Atmospheric
    "frozen lake at twilight, cracked ice patterns, distant snow-capped peaks reflected, Iceland",
    "terraced rice paddies filled with water reflecting sunset, Bali, aerial perspective",
    "lightning bolt striking a distant mesa, dark storm clouds, desert foreground, long exposure, Arizona",
    "northern lights reflecting in a fjord, green and purple aurora, snow-covered shores, Norway",
    "fog rolling through Golden Gate Bridge towers, only the tops visible, San Francisco, early morning",
  ],
  animals: [
    // Wildlife
    "red fox standing in fresh snow, breath visible, early morning light, forest edge background",
    "barn owl perched on a weathered fence post, soft bokeh background, overcast day, UK countryside",
    "humpback whale breaching, water droplets frozen mid-air, overcast ocean, telephoto compression",
    "polar bear mother with two cubs walking across tundra, soft pink sunset light, Churchill Manitoba",
    "bald eagle in flight carrying a fish, river and forest below, sharp detail on feathers, Alaska",
    "grizzly bear fishing at a waterfall, salmon jumping, mist in air, Katmai National Park",
    "snow leopard on a rocky outcrop, camouflaged against grey stone, Himalayas, rare sighting",
    "pack of wolves trotting through deep snow, Yellowstone, breath visible, golden light, telephoto",
    "king penguin colony, thousands in frame, South Georgia Island, one standing in foreground sharp",
    // Pets and domestic
    "border collie mid-leap catching a frisbee, frozen motion, park setting, shallow depth of field",
    "tabby cat curled up on a worn leather armchair, afternoon sunbeam, dust motes visible",
    "golden retriever shaking off water at a lake, frozen droplets, backlit, summer afternoon",
    "black cat sitting on a windowsill, city lights bokeh behind, nighttime, green eyes glowing",
    "old beagle sleeping on a porch, warm light, wooden boards, peaceful summer evening",
    "horse and rider silhouetted against sunset, dust kicked up, ranch fence line, Western",
    "kitten playing with a ball of yarn on a hardwood floor, window light, curious expression",
    // Macro and close-up
    "monarch butterfly on a milkweed plant, macro shot, morning dew visible on wings",
    "sea otter floating on its back in kelp, Monterey Bay, eye-level water shot, whiskers in detail",
    "dragonfly perched on a reed, compound eyes in sharp detail, pond bokeh background, macro lens",
    "tree frog clinging to a wet leaf, vivid green skin, water droplets, Costa Rican cloud forest",
    "ladybug on a blade of grass, early morning dew drops, extreme macro, soft green background",
    // Marine
    "sea turtle swimming through crystal clear water, sunbeams from surface, coral reef below",
    "school of sardines forming a bait ball, diver silhouetted above, underwater photography, blue water",
    "clownfish in an anemone, macro underwater shot, vibrant orange against purple tentacles",
    "manta ray gliding overhead, shot from below, sun creating silhouette, Maldives",
  ],
  food: [
    // Baked goods
    "sourdough loaf with deep ear scoring on a wire cooling rack, rustic wooden counter, flour dusted, side lighting",
    "croissants fresh from the oven, flaky layers visible, baking sheet, steam rising, bakery kitchen",
    "artisan bread display at a farmers market, various shapes and crusts, morning sunlight, hand-written labels",
    "cinnamon rolls with cream cheese icing dripping, cast iron skillet, rustic table, overhead shot",
    // Asian cuisine
    "steaming bowl of tonkotsu ramen, soft-boiled egg halved, chashu pork, chopsticks resting on bowl edge, overhead shot",
    "hand-rolled sushi on a hinoki wood board, ginger and wasabi, natural daylight from left, 45-degree angle",
    "dim sum bamboo steamers stacked, har gow and siu mai, tea pot, Chinese restaurant table, warm light",
    "Thai green curry in a clay bowl, jasmine rice, fresh basil garnish, banana leaf underneath, Bangkok street food",
    "Korean bibimbap in a hot stone bowl, egg yolk unbroken on top, vegetables arranged in sections, sizzling edges",
    // Western dishes
    "wood-fired margherita pizza on a peel, charred crust bubbles, San Marzano tomatoes visible, steam rising",
    "stack of blueberry pancakes with melting butter pat, syrup mid-pour, diner setting, warm light",
    "molten chocolate fondant on a white plate, powdered sugar dusted, raspberry coulis swoosh, restaurant plating",
    "charcuterie board with aged cheeses, cured meats, figs, honey, crackers, marble surface, overhead",
    "grilled ribeye steak medium rare, cross-section visible, cast iron pan, herb butter melting, smoke rising",
    "lobster roll overflowing with chunks, buttered split-top bun, paper tray, New England waterfront background",
    // Produce and ingredients
    "farmers market display of heirloom tomatoes, various colors and sizes, morning sun, overhead perspective",
    "bowl of fresh berries with morning dew, white ceramic, linen napkin, natural window light, close-up",
    "spice market stall with pyramids of colorful ground spices, brass scoops, warm ambient light, Morocco",
    "olive oil being poured onto a caprese salad, motion freeze, tomatoes and mozzarella, garden table",
    // Drinks
    "latte art being poured, rosetta pattern forming in cup, barista hands visible, coffee shop counter",
    "craft cocktail with smoke bubble on top, bar counter, moody low lighting, copper tools behind",
    "matcha being whisked in a ceramic bowl, bamboo chasen, Japanese tea ceremony, overhead angle",
    "fresh orange juice in glass pitcher, sliced oranges, bright morning kitchen, condensation on glass",
    "red wine being poured into a glass, vineyard sunset behind, Tuscany, golden backlight through wine",
  ],
  architecture: [
    // Modern
    "brutalist concrete apartment block, geometric repeating balconies, flat overcast sky, shot from street level",
    "modern glass office tower reflecting sunset clouds, shot from below with converging verticals",
    "Frank Gehry curved titanium panels, Bilbao, overcast sky reflecting in surface, wide angle",
    "minimalist concrete church interior, single beam of light from skylight, Tadao Ando style",
    "contemporary wooden cabin cantilevered over a hillside, floor-to-ceiling glass, forest setting, dusk",
    "Dubai Marina towers at blue hour, reflections in water, long exposure light trails on road",
    // Historic
    "gothic cathedral nave interior, ribbed vaults, late afternoon light through rose window, no people",
    "narrow cobblestone alley in Lisbon, azulejo tile facades, hanging laundry, warm afternoon light",
    "art deco cinema entrance, neon marquee, terrazzo floor, evening blue hour, symmetrical composition",
    "traditional Japanese machiya townhouse, wooden lattice facade, Kyoto backstreet, diffused light",
    "Venetian palazzo reflected in canal, weathered pink stucco, green shutters, morning light, gondola passing",
    "half-timbered medieval buildings lining a market square, Colmar France, flower boxes, overcast afternoon",
    "Moorish archways with intricate tile work, Alhambra Granada, courtyard with reflecting pool",
    // Decay and industrial
    "abandoned textile mill, broken windows, vines growing through brick, moody overcast, wide angle",
    "rusting steel bridge over a river, industrial city backdrop, foggy morning, muted tones",
    "overgrown greenhouse, shattered glass panels, plants reclaiming the space, golden light filtering through",
    "Detroit abandoned theater, ornate plasterwork crumbling, single shaft of light from collapsed roof",
    // Interiors and details
    "spiral staircase from directly above, geometric pattern, marble steps, ornate iron railing",
    "mid-century modern living room, Eames chair, warm afternoon light, record player, minimal clutter",
    "old wooden bookshop interior, floor to ceiling shelves, rolling ladder, warm lamp light, Oxford",
    "train station concourse, vaulted iron and glass ceiling, morning rush commuters blurred, Grand Central",
    // Sacred and monumental
    "Buddhist temple at dawn, gold leaf details catching first light, incense smoke, Chiang Mai Thailand",
    "ancient Roman aqueduct stretching across a valley, sunset behind, Segovia Spain, dramatic scale",
    "white-washed Greek Orthodox church with blue dome, Santorini, deep blue Aegean Sea behind, noon sun",
    "Angkor Wat reflected in lotus-filled moat, dawn, temple silhouette, Cambodia, pink and purple sky",
  ],
  art: [
    // Paintings and galleries
    "oil painting of a stormy North Sea in an ornate gilded frame, gallery wall with spot lighting",
    "visitor standing in front of a massive Rothko color field painting, museum scale, contemplative",
    "Dutch Golden Age still life with fruit and flowers, dramatic chiaroscuro, ornate frame, museum wall",
    "Impressionist landscape in a sunlit gallery, visitors reflected in protective glass, Musee d'Orsay",
    "contemporary abstract painting, thick impasto texture, artist studio wall, paint-splattered floor",
    // Sculpture and installation
    "large Cor-Ten steel sculpture in a sculpture garden, autumn trees background, overcast sky",
    "marble bust in a museum, Bernini style, dramatic side lighting, dark background, extreme detail",
    "neon light installation in a dark gallery, pink and blue reflections on polished floor",
    "kinetic sculpture with hanging mobile elements, museum atrium, natural light from above, Calder style",
    "ice sculpture melting in a gallery, water pooling beneath, impermanence captured, cold blue light",
    // Street art and murals
    "vibrant street mural covering a three-story brick wall, spray paint texture visible, urban setting",
    "Banksy-style stencil on a crumbling wall, political commentary, monochrome with one color accent",
    "yarn bombing on a city bridge railing, colorful knitted covers, overcast urban setting, playful",
    "wheat paste portrait on a construction hoarding, peeling edges, rain-dampened, city sidewalk",
    // Craft and making
    "potter's wheel with wet clay being shaped, hands in frame, studio with natural skylight",
    "printmaker pulling an etching from a press, ink on hands, workshop with hanging prints drying",
    "glassblower shaping molten glass, orange glow, dark workshop, intense heat visible, action shot",
    "weaver at a large floor loom, colorful threads, natural light from side window, concentrated expression",
    "blacksmith hammering red-hot metal, sparks flying, dark forge, dramatic contrast",
    // Architecture as art
    "stained glass window detail, lead came visible, backlit by overcast sky, interior view, medieval church",
    "Japanese zen rock garden, raked gravel patterns, mossy boulders, temple wall behind, Ryoanji",
    "large scale charcoal drawing pinned to a studio wall, graphite smudges, artist tools on table below",
    "ceramic collection on wooden shelves, earth-toned glazes, studio with northern light, hand-made quality",
    "bronze casting workshop, lost-wax molds, patina chemicals, industrial space, work in progress",
  ],
  street: [
    // Night scenes
    "rain-slicked city street at night, neon signs reflecting in puddles, lone pedestrian with umbrella, Tokyo",
    "food cart with steam rising, night market, string lights overhead, customers waiting, Taipei",
    "empty subway platform at 2am, fluorescent lights, lone commuter on a bench, tile walls, New York",
    "jazz club exterior, red neon sign, bouncer at door, cigarette smoke, wet sidewalk, New Orleans",
    "convenience store glowing on a dark street corner, figure walking past, urban isolation, Edward Hopper mood",
    // Urban life
    "Shibuya crossing from above, rush hour, motion blur on pedestrians, sharp buildings, overcast",
    "street musician playing upright bass on a Paris metro platform, motion blur of passing train, warm tungsten",
    "market stall overflowing with colorful spices, vendor weighing on brass scale, Istanbul",
    "cyclist splashing through a puddle on a cobblestone street, frozen water droplets, Amsterdam",
    "newspaper stand vendor in morning light, stacks of papers, coffee cup, early risers passing",
    "outdoor cafe in Rome, espresso cups on small tables, locals reading newspapers, morning light",
    "fish market at dawn, ice and fresh catch, workers in rubber boots, harsh fluorescent overhead, Tokyo Tsukiji",
    "fruit vendor arranging display on a sidewalk, pyramids of mangoes and papayas, Mumbai",
    // Transport and vehicles
    "vintage car parked on an empty desert highway, heat shimmer, vanishing point composition, Route 66",
    "yellow taxi in rain, Times Square reflections, motion blur, night, iconic New York moment",
    "steam rising from a manhole cover on a cold morning, city sidewalk, pedestrians walking through, atmospheric",
    "ferry crossing a choppy harbor, city skyline behind, overcast, seagulls, Istanbul Bosphorus",
    "bicycle leaning against a canal railing, autumn leaves on ground, Amsterdam, soft overcast light",
    "tram rounding a corner on cobblestones, overhead wires, Lisbon, steep hill, pastel buildings",
    // Weather and atmosphere
    "umbrella crowd at a busy intersection, monsoon rain, Mumbai, reflections everywhere, overhead shot",
    "snow falling on a quiet residential street, warm window glow from houses, footprints, dusk, Scandinavia",
    "heat haze rising from asphalt, desert gas station, lone figure, American Southwest, noon sun",
    "fog rolling down a San Francisco hill, Victorian houses emerging, car headlights, early morning",
    "autumn leaves blowing across an empty park path, wrought iron bench, golden light, Central Park",
  ],
};

export function pickPrompt(category: string): string | null {
  const prompts = PROMPTS[category];
  if (!prompts) return null;
  return prompts[Math.floor(Math.random() * prompts.length)];
}

export function cameraStyle(): string {
  return CAMERA_STYLES[Math.floor(Math.random() * CAMERA_STYLES.length)];
}

export function randomCategory(): string {
  const cats = Object.keys(PROMPTS);
  return cats[Math.floor(Math.random() * cats.length)];
}
