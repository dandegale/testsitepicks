export function createFighterSlug(name) {
  if (!name) return '';

  const lowerName = name.toLowerCase().trim();

  // --- MANUAL OVERRIDES (Fix API Mismatches Here) ---
  // Format: "name on your site" : "slug for the api"
  const overrides = {
    "alex volkanovski": "alexander-volkanovski",
    "chan sung jung": "korean-zombie", 
    "tj dillashaw": "t-j-dillashaw",
    "marc andre barriault": "marc-andre-barriault", // Ensure spaces match
    "benoit saint denis": "benoit-saint-denis"
  };

  // 1. Check if we have an override first
  if (overrides[lowerName]) {
    return overrides[lowerName];
  }

  // 2. Otherwise, do the standard slugify
  return lowerName
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents (André -> Andre)
    .replace(/\./g, "")       // Remove dots
    .replace(/'/g, "")        // Remove apostrophes
    .replace(/\s+/g, '-');    // Replace spaces with dashes
}