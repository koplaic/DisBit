// bitjitaClient.js
const fetch = require('node-fetch');

const BASE_URL = 'https://bitjita.com';

// Rate limiting config
const MAX_CALLS_PER_MINUTE = 200;        // safety cap (API limit is 250/min)
const WINDOW_MS = 60 * 1000;

const recentCalls = []; // timestamps (ms) of recent API calls

async function enforceRateLimit() {
  const now = Date.now();

  // Drop timestamps older than the window
  while (recentCalls.length && now - recentCalls[0] > WINDOW_MS) {
    recentCalls.shift();
  }

  if (recentCalls.length >= MAX_CALLS_PER_MINUTE) {
    // We've hit our internal cap; wait until the oldest call falls outside the window
    const waitMs = WINDOW_MS - (now - recentCalls[0]);
    const waitSeconds = Math.ceil(waitMs / 1000);

    console.warn(
      `[Bitjita rate limit] ${recentCalls.length} calls in the last minute. Waiting ~${waitSeconds}s before next call.`
    );

    await new Promise(resolve => setTimeout(resolve, waitMs));

    // After waiting, clean up again
    const later = Date.now();
    while (recentCalls.length && later - recentCalls[0] > WINDOW_MS) {
      recentCalls.shift();
    }
  }

  // Record this call
  recentCalls.push(Date.now());
}

// Helper: fetch JSON from a given /api/... path (rate-limited)
async function fetchJson(path) {
  await enforceRateLimit(); // ensure we stay under MAX_CALLS_PER_MINUTE

  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Disbit (Bitcraft Discord bot)',
      'x-app-identifier': 'DisbitBot',
    },
  });

  if (!res.ok) {
    throw new Error(`Bitjita API request failed: ${res.status} ${res.statusText} for ${url}`);
  }

  return res.json();
}

/**
 * Get a single empire by ID using:
 * GET /api/empires/[id]
 */
async function getEmpireById(id) {
  return fetchJson(`/api/empires/${id}`);
}

/**
 * Get all claims belonging to an empire using:
 * GET /api/empires/[id]/claims
 */
async function getEmpireClaims(id) {
  return fetchJson(`/api/empires/${id}/claims`);
}

/**
 * Get empire info + members using:
 * GET /api/empires/[id]/members
 *
 * Example response:
 * {
 *   empire: { ... },
 *   members: [ ... ],
 *   count: 14
 * }
 */
async function getEmpireMembers(id) {
  return fetchJson(`/api/empires/${id}`);
}

/**
 * Search empires by name using:
 * GET /api/empires?q=Name
 */
async function searchEmpiresByName(name) {
  const query = encodeURIComponent(name);
  const data = await fetchJson(`/api/empires?q=${query}`);

  const empires = Array.isArray(data) ? data : (data.empires || []);
  return empires;
}

/**
 * Try to extract an empire ID from a Bitjita URL or numeric input.
 * Example URL: https://bitjita.com/empires/6500896/overview
 */
function parseEmpireIdFromInput(input) {
  const trimmed = input.trim();

  // If input is purely numeric, treat it as an ID
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  // Try to pull a number after /empires/ in a URL
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('empires');
    if (idx !== -1 && parts[idx + 1]) {
      const possibleId = parts[idx + 1];
      if (/^\d+$/.test(possibleId)) {
        return possibleId;
      }
    }
  } catch (e) {
    // Not a valid URL; ignore
  }

  return null;
}

/**
 * Get inventories for a specific claim using:
 * GET /api/claims/[id]/inventories
 */
async function getClaimInventories(claimId) {
  return fetchJson(`/api/claims/${claimId}/inventories`);
}

/**
 * Get player/character details by entityId using:
 * GET /api/players/[id]
 *
 * Example response:
 * {
 *   player: {
 *     entityId,
 *     username,
 *     experience: [...],
 *     skillMap: { ... },
 *     claims: [...],
 *     empireMemberships: [...],
 *     ...
 *   }
 * }
 */
async function getPlayerById(id) {
  return fetchJson(`/api/players/${id}`);
}
/**
 * Get equipment for a specific player:
 * GET /api/players/[id]/equipment
 */
async function getPlayerEquipment(id) {
  return fetchJson(`/api/players/${id}/equipment`);
}

/**
 * Get inventories for a specific player:
 * GET /api/players/[id]/inventories
 */
async function getPlayerInventories(id) {
  return fetchJson(`/api/players/${id}/inventories`);
}

/**
 * Get all claims belonging to an empire:
 * GET /api/empires/[id]/claims
 */
async function getEmpireClaims(id) {
  // ensure this uses the correct path
  return fetchJson(`/api/empires/${id}/claims`);
}

/**
 * Get buildings for a specific claim:
 * GET /api/claims/[id]/buildings
 */
async function getClaimBuildings(claimId) {
  return fetchJson(`/api/claims/${claimId}/buildings`);
}

/**
 * Get detailed information about a specific building:
 * GET /api/buildings/[id]
 */
async function getBuildingById(id) {
  return fetchJson(`/api/buildings/${id}`);
}

module.exports = {
  // existing exports ...
  getEmpireById,
  getEmpireClaims,
  getEmpireMembers,
  searchEmpiresByName,
  parseEmpireIdFromInput,
  getClaimInventories,
  getPlayerById,
  getPlayerEquipment,
  getPlayerInventories,
  getClaimBuildings,
  getBuildingById,
};