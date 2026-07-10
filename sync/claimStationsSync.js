// sync/claimStationsSync.js
const {
  getEmpireClaims,
  getClaimBuildings,
} = require('../bitjitaClient');
const { upsertClaimStation } = require('../db/claimStations');

/**
 * Very simple heuristic: treat certain buildingDescriptionId/name patterns as stations
 * and infer type/tier. You can refine this mapping over time.
 */
function classifyStation(building) {
  const name = building.buildingName || building.buildingNickname || '';
  const descId = building.buildingDescriptionId;

  // Example heuristic: names like "Smithing Station T2"
  const lowerName = name.toLowerCase();
  let stationType = null;
  let stationTier = null;

  if (lowerName.includes('smith')) {
    stationType = 'Smithing';
  } else if (lowerName.includes('carp')) {
    stationType = 'Carpentry';
  } else if (lowerName.includes('tailor')) {
    stationType = 'Tailoring';
  } else if (lowerName.includes('mason')) {
    stationType = 'Masonry';
  } else if (lowerName.includes('leather')) {
    stationType = 'Leatherworking';
  }

  // Tier detection: look for 'T1', 'T2', 'T3' in name
  const match = lowerName.match(/t([1-5])/);
  if (match) {
    stationTier = parseInt(match[1], 10);
  }

  // If no clear type or tier, skip classification
  if (!stationType || !stationTier) {
    return null;
  }

  return { stationType, stationTier };
}

async function syncClaimStations(empireId) {
  const nowIso = new Date().toISOString();

  // 1) Get all claims for this empire
  const claims = await getEmpireClaims(empireId);
  const claimsArray = Array.isArray(claims) ? claims : claims.claims || [];

  for (const claim of claimsArray) {
    const claimId = String(claim.entityId || claim.id);
    const regionId = claim.regionId ?? null;

    let buildingsResp;
    try {
      buildingsResp = await getClaimBuildings(claimId);
    } catch (err) {
      console.error('Failed to fetch buildings for claim', claimId, err);
      continue;
    }

    const buildings = buildingsResp.buildings || buildingsResp || [];

    for (const b of buildings) {
      const classification = classifyStation(b);
      if (!classification) continue;

      const row = {
        $claim_id: claimId,
        $building_id: String(b.entityId),
        $empire_id: String(empireId),
        $station_type: classification.stationType,
        $station_tier: classification.stationTier,
        $name: b.buildingName || b.buildingNickname || '',
        $region_id: regionId,
        $snapshot_at: nowIso,
      };

      try {
        await upsertClaimStation(row);
      } catch (err) {
        console.error('Failed to upsert station', b.entityId, err);
      }
    }
  }
}

module.exports = {
  syncClaimStations,
};