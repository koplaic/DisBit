// sync/empireMembersSync.js
const {
  getEmpireMembers: getEmpireMembersFromApi,
  getPlayerById,
} = require('../bitjitaClient');
const {
  upsertEmpireMember,
  getMemberSyncMetadata,
} = require('../db/empireMembers');
const { getLevelForXp } = require('../experienceLevels');

// How often we allow detailed player sync per member (in ms)
const PLAYER_DETAIL_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

function shouldSyncPlayerDetails(lastPlayerSyncAt) {
  if (!lastPlayerSyncAt) return true;
  const last = new Date(lastPlayerSyncAt).getTime();
  const now = Date.now();
  return now - last > PLAYER_DETAIL_COOLDOWN_MS;
}

async function syncEmpireMembers(empireId) {
  const nowIso = new Date().toISOString();

  // 1) Fetch empire roster (the JSON with "empire" + "members")
  const roster = await getEmpireMembersFromApi(empireId);
  const members = roster.members || [];

  // Map of character_id -> last_player_sync_at (from DB)
  const existing = await getMemberSyncMetadata(empireId);
  const syncMetaMap = new Map();
  for (const row of existing) {
    syncMetaMap.set(String(row.character_id), row.last_player_sync_at);
  }

  for (const m of members) {
    const characterId = String(m.entityId);
    const playerName = m.playerName;
    const rankNumeric = m.rank;
    const rankTitle = m.rankTitle;
    const totalXp = m.totalXP;
    const donatedShards = Number(m.donatedShards || 0);
    const donatedEmpireCurrency = Number(m.donatedEmpireCurrency || 0);
    const lastLoginAt = m.lastLoginTimestamp || null;

    let timePlayed = null;
    let timeSignedIn = null;
    let regionId = null;
    let regionName = null;
    let homeClaimId = null;
    let homeClaimName = null;
    let homeClaimRegionId = null;
    let skillXpJson = null;
    let claimsJson = null;
    let empireMembershipsJson = null;
    let lastPlayerSyncAt = syncMetaMap.get(characterId) || null;

    // Decide if we should sync detailed player data for this member now
    let playerDetails = null;
    if (shouldSyncPlayerDetails(lastPlayerSyncAt)) {
      try {
        playerDetails = await getPlayerById(characterId);
        lastPlayerSyncAt = nowIso; // we are updating details now
      } catch (err) {
        console.error('Failed to fetch player details for', characterId, err);
      }
    }

    if (playerDetails && playerDetails.player) {
      const p = playerDetails.player;

      timePlayed = p.timePlayed ?? null;
      timeSignedIn = p.timeSignedIn ?? null;
      regionId = p.regionId ?? null;

      // Home claim from `location`
      if (p.location) {
        homeClaimId = String(p.location.entityId);
        homeClaimName = p.location.name;
        homeClaimRegionId = p.location.regionId ?? null;
      }

      // Skills: map experience[] + skillMap into JSON with levels
      if (Array.isArray(p.experience) && p.skillMap) {
        const skillMap = {};
        for (const entry of p.experience) {
          const skillMeta = p.skillMap[entry.skill_id];
          if (!skillMeta) continue;

          const xp = entry.quantity;
          const level = await getLevelForXp(xp);

          skillMap[skillMeta.name] = {
            xp,
            level,
            id: entry.skill_id,
            title: skillMeta.title,
            category: skillMeta.skillCategoryStr,
          };
        }
        skillXpJson = JSON.stringify(skillMap);
      }

      // Claims and permissions as JSON
      if (Array.isArray(p.claims)) {
        claimsJson = JSON.stringify(p.claims);
      }

      // Empire memberships as JSON
      if (Array.isArray(p.empireMemberships)) {
        empireMembershipsJson = JSON.stringify(p.empireMemberships);
      }
    }

    const row = {
      $character_id: characterId,
      $empire_id: String(m.empireEntityId),
      $player_name: playerName,
      $rank_numeric: rankNumeric,
      $rank_title: rankTitle,
      $total_xp: totalXp,
      $donated_shards: donatedShards,
      $donated_empire_currency: donatedEmpireCurrency,
      $last_login_at: lastLoginAt,
      $time_played: timePlayed,
      $time_signed_in: timeSignedIn,
      $region_id: regionId,
      $region_name: regionName,
      $home_claim_id: homeClaimId,
      $home_claim_name: homeClaimName,
      $home_claim_region_id: homeClaimRegionId,
      $skill_xp_json: skillXpJson,
      $claims_json: claimsJson,
      $empire_memberships_json: empireMembershipsJson,
      $snapshot_at: nowIso,
      $last_player_sync_at: lastPlayerSyncAt,
    };

    try {
      await upsertEmpireMember(row);
    } catch (err) {
      console.error('Failed to upsert empire member', characterId, err);
    }
  }

  return members.length;
}

module.exports = {
  syncEmpireMembers,
};