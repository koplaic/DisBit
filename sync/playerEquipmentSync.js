// sync/playerEquipmentSync.js
const {
  getPlayerEquipment,
  getPlayerInventories,
} = require('../bitjitaClient');
const {
  upsertEmpireMember,
  getMemberSyncMetadata,
} = require('../db/empireMembers');

// Cooldown for equipment/inventory sync per member (in ms)
const EQUIPMENT_SYNC_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

function shouldSyncEquipment(lastEquipmentSyncAt) {
  if (!lastEquipmentSyncAt) return true;
  const last = new Date(lastEquipmentSyncAt).getTime();
  const now = Date.now();
  return now - last > EQUIPMENT_SYNC_COOLDOWN_MS;
}

/**
 * Sync equipment and inventories for all members of an empire.
 * Expects that empire_members has already been populated by syncEmpireMembers.
 */
async function syncPlayerEquipmentForEmpire(empireId) {
  const nowIso = new Date().toISOString();

  // Get metadata: which members exist and when we last synced equipment for them
  const meta = await getMemberSyncMetadata(empireId);
  const syncMetaMap = new Map();
  for (const row of meta) {
    syncMetaMap.set(String(row.character_id), row.last_equipment_sync_at);
  }

  // We also need base member rows (with existing data) so we can upsert without losing other fields.
  // Reuse getEmpireMembers to fetch rows from SQLite.
  const db = require('../db/sqlite');
  const rows = await new Promise((resolve, reject) => {
    db.all(
      `
        SELECT *
        FROM empire_members
        WHERE empire_id = ?
      `,
      [empireId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });

  for (const m of rows) {
    const characterId = String(m.character_id);
    let lastEquipmentSyncAt = syncMetaMap.get(characterId) || null;

    if (!shouldSyncEquipment(lastEquipmentSyncAt)) {
      continue;
    }

    let equipmentJson = null;
    let inventoryJson = null;

    try {
      const equipment = await getPlayerEquipment(characterId);
      equipmentJson = JSON.stringify(equipment);
    } catch (err) {
      console.error('Failed to fetch equipment for', characterId, err);
    }

    try {
      const inventories = await getPlayerInventories(characterId);
      inventoryJson = JSON.stringify(inventories);
    } catch (err) {
      console.error('Failed to fetch inventories for', characterId, err);
    }

    lastEquipmentSyncAt = nowIso;

    const row = {
      $character_id: characterId,
      $empire_id: String(m.empire_id),
      $player_name: m.player_name,
      $rank_numeric: m.rank_numeric,
      $rank_title: m.rank_title,
      $total_xp: m.total_xp,
      $donated_shards: m.donated_shards,
      $donated_empire_currency: m.donated_empire_currency,
      $last_login_at: m.last_login_at,
      $time_played: m.time_played,
      $time_signed_in: m.time_signed_in,
      $region_id: m.region_id,
      $region_name: m.region_name,
      $home_claim_id: m.home_claim_id,
      $home_claim_name: m.home_claim_name,
      $home_claim_region_id: m.home_claim_region_id,
      $skill_xp_json: m.skill_xp_json,
      $claims_json: m.claims_json,
      $empire_memberships_json: m.empire_memberships_json,
      $equipment_json: equipmentJson || m.equipment_json,
      $inventory_json: inventoryJson || m.inventory_json,
      $snapshot_at: m.snapshot_at,
      $last_player_sync_at: m.last_player_sync_at,
      $last_equipment_sync_at: lastEquipmentSyncAt,
    };

    try {
      await upsertEmpireMember(row);
    } catch (err) {
      console.error('Failed to upsert equipment for member', characterId, err);
    }
  }

  return rows.length;
}

module.exports = {
  syncPlayerEquipmentForEmpire,
};