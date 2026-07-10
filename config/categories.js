// config/categories.js

// Centralized category definitions and colors
const categoriesConfig = {
  'Wood & Forestry': { color: 0x8B5A2B },      // brown
  'Farming & Plants': { color: 0x228B22 },     // dark green
  'Cooking & Food': { color: 0xFFA500 },       // orange
  'Textiles & Leather': { color: 0x32CD32 },   // bright green
  'Metals & Sands': { color: 0x1E90FF },       // blue
  'Crafting Reagents': { color: 0xDAA520 },    // golden
  'Bait & Fishing': { color: 0x4B0082 },       // indigo
  'Special & Rare': { color: 0xAAAAAA },       // grey
};

// Shared classification logic, tuned to Bitcraft item types [web:154][web:155][web:162]
function classifyCategory(tag, name) {
  const t = (tag || '').toLowerCase();
  const n = (name || '').toLowerCase();

  // Wood & Forestry: logs, bark, stripped wood, tree seeds, woodcraft tools
  if (
    t.includes('wood') ||
    t.includes('tree') ||
    t.includes('bark') ||
    n.includes('log') ||
    n.includes('plank') ||
    n.includes('stripped wood') ||
    n.includes('sapling') ||
    (n.includes('seed') && (
      n.includes('birch') ||
      n.includes('pine') ||
      n.includes('oak') ||
      n.includes('cypress') ||
      n.includes('beech')
    )) ||
    n.includes('sandpaper') // Woodworking Sandpaper
  ) {
    return 'Wood & Forestry';
  }

  // Farming & Plants: general seeds and plants, crops (starbulb, embergrain, bulbs, grains) [web:159]
  if (
    t.includes('seed') ||
    t.includes('crop') ||
    n.includes('seed') ||
    n.includes('plant') ||
    n.includes('bulb') ||
    n.includes('grain') ||
    n.includes('starbulb') ||
    n.includes('embergrain')
  ) {
    return 'Farming & Plants';
  }

  // Cooking & Food: raw/cooked meat, fish, berries, dough, mashed foods, food oils [web:161][web:163]
  if (
    t.includes('food') ||
    t.includes('berry') ||
    t.includes('meat') ||
    t.includes('fish') ||
    n.includes('roasted') ||
    n.includes('mashed') ||
    n.includes('stew') ||
    n.includes('dough') ||
    n.includes('filet') ||
    n.includes('raw meat') ||
    n.includes('plain roasted') ||
    n.includes('zesty roasted') ||
    n.includes('auratus') ||
    n.includes('dolo') ||
    n.includes('guppi') ||
    n.includes('oil') // fish/crop oils used in cooking
  ) {
    return 'Cooking & Food';
  }

  // Textiles & Leather: cloth, fiber, thread, spools, leather items
  if (
    t.includes('fiber') ||
    t.includes('cloth') ||
    t.includes('thread') ||
    t.includes('leather') ||
    n.includes('cloth') ||
    n.includes('fiber') ||
    n.includes('spool') ||
    n.includes('gloves') ||
    n.includes('hide') ||
    n.includes('pelt') ||
    n.includes('sail cloth')
  ) {
    return 'Textiles & Leather';
  }

  // Metals & Sands: ingots, ores, molten metals, ore concentrates, firesand, general sands [web:157][web:162]
  if (
    t.includes('ingot') ||
    t.includes('ore') ||
    t.includes('metal') ||
    n.includes('ingot') ||
    n.includes('ore concentrate') ||
    n.includes('molten') ||
    n.includes('pyrelite') ||
    n.includes('ferralith') ||
    n.includes('emarium') ||
    n.includes('elenvar') ||
    n.includes('firesand') ||
    n.includes('sand') // fine/basic/simple/infused sand
  ) {
    return 'Metals & Sands';
  }

  // Crafting Reagents: sap, resin, clay, tannin, pigments, solvents, chemical bases [web:160]
  if (
    n.includes('sap') ||
    n.includes('resin') ||
    t.includes('clay') ||
    n.includes('clay lump') ||
    n.includes('tannin') ||
    t.includes('pigment') ||
    n.includes('pigment') ||
    t.includes('solvent') ||
    n.includes('solvent') ||
    n.includes('chemical base')
  ) {
    return 'Crafting Reagents';
  }

  // Bait & Fishing: bait tiers, fish used primarily as bait, swill [web:163]
  if (
    t.includes('bait') ||
    n.includes('bait') ||
    t.includes('fish') ||
    n.includes('filet') || // many filets are fishing outputs
    n.includes('swill') ||
    n.includes('school')
  ) {
    return 'Bait & Fishing';
  }

  // Special & Rare: doubloons, sanddollars, gems, curios
  if (
    n.includes('doubloon') ||
    n.includes('sanddollar') ||
    n.includes('gem') ||
    n.includes('rare') ||
    n.includes('curio')
  ) {
    return 'Special & Rare';
  }

  // Default fallback
  return 'Special & Rare';
}

// Helper: build a categories map with colors and items array
function createCategoryBuckets() {
  const buckets = {};
  for (const [name, cfg] of Object.entries(categoriesConfig)) {
    buckets[name] = { color: cfg.color, items: [] };
  }
  return buckets;
}

module.exports = {
  categoriesConfig,
  classifyCategory,
  createCategoryBuckets,
};