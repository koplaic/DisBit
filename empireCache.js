// empireCache.js
const {
  getEmpireClaims,
  getClaimInventories,
} = require('./bitjitaClient');

// Simple in-memory cache: empireId -> snapshot
// Snapshot shape: { claims, buildingsByClaimId, timestamp }
const cache = new Map();

// Time-to-live for cache entries (ms)
const TTL_MS = 60 * 1000; // 60 seconds; adjust as needed [web:169]

function isFresh(entry) {
  if (!entry) return false;
  const age = Date.now() - entry.timestamp;
  return age < TTL_MS;
}

/**
 * Load a snapshot of claims and building inventories for an empire.
 * Uses in-memory cache with TTL to avoid repeated API calls. [web:165][web:167]
 */
async function loadEmpireSnapshot(empireId) {
  const existing = cache.get(empireId);
  if (isFresh(existing)) {
    return existing;
  }

  // Cache miss or stale: fetch fresh data from Bitjita
  let claims = await getEmpireClaims(empireId);
  if (!Array.isArray(claims)) {
    claims = claims.claims || claims.data || [];
  }

  const buildingsByClaimId = {};

  for (const claim of claims) {
    const claimId = claim.entityId || claim.claimId || claim.id;
    if (!claimId) continue;

    try {
      let inventories = await getClaimInventories(claimId);
      let buildings = inventories;
      if (!Array.isArray(buildings)) {
        buildings = buildings.buildings || buildings.data || [];
      }

      buildingsByClaimId[claimId] = buildings;
    } catch (err) {
      console.warn(`empireCache: failed to fetch inventories for claim ${claimId}:`, err.message);
      buildingsByClaimId[claimId] = [];
    }
  }

  const snapshot = {
    claims,
    buildingsByClaimId,
    timestamp: Date.now(),
  };

  cache.set(empireId, snapshot);
  return snapshot;
}

/**
 * Optional: allow manual invalidation (e.g., from a future /refresh command).
 */
function invalidateEmpireSnapshot(empireId) {
  cache.delete(empireId);
}

module.exports = {
  loadEmpireSnapshot,
  invalidateEmpireSnapshot,
};