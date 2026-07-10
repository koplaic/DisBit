// db/empireMembers.js
const db = require('./sqlite');

// Initialize table (new columns only apply to new DBs; existing DBs keep old schema)
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS empire_members (
      character_id TEXT NOT NULL,
      empire_id TEXT NOT NULL,
      player_name TEXT NOT NULL,

      -- rank & progression
      rank_numeric INTEGER,
      rank_title TEXT,
      total_xp INTEGER,
      donated_shards INTEGER,
      donated_empire_currency INTEGER,
      last_login_at TEXT,

      -- player-level activity
      time_played INTEGER,
      time_signed_in INTEGER,

      -- location/home
      region_id INTEGER,
      region_name TEXT,
      home_claim_id TEXT,
      home_claim_name TEXT,
      home_claim_region_id INTEGER,

      -- JSON blobs for enrichment
      skill_xp_json TEXT,            -- per-skill XP and metadata (xp + level)
      claims_json TEXT,              -- claims & memberPermissions
      empire_memberships_json TEXT,  -- player.empireMemberships as JSON
      equipment_json TEXT,           -- equipped items/tools snapshot
      inventory_json TEXT,           -- player inventories snapshot

      -- sync metadata
      snapshot_at TEXT NOT NULL,     -- when this row was last upserted (any data)
      last_player_sync_at TEXT,      -- when we last called getPlayerById for this member
      last_equipment_sync_at TEXT,   -- when we last called equipment/inventories for this member

      PRIMARY KEY (character_id, empire_id)
    )
  `);
});

/**
 * Upsert a single empire member row.
 *
 * Expects a params object with keys:
 *  $character_id, $empire_id, $player_name,
 *  $rank_numeric, $rank_title, $total_xp,
 *  $donated_shards, $donated_empire_currency, $last_login_at,
 *  $time_played, $time_signed_in,
 *  $region_id, $region_name,
 *  $home_claim_id, $home_claim_name, $home_claim_region_id,
 *  $skill_xp_json, $claims_json, $empire_memberships_json,
 *  $equipment_json, $inventory_json,
 *  $snapshot_at, $last_player_sync_at, $last_equipment_sync_at
 */
function upsertEmpireMember(row) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO empire_members (
        character_id,
        empire_id,
        player_name,
        rank_numeric,
        rank_title,
        total_xp,
        donated_shards,
        donated_empire_currency,
        last_login_at,
        time_played,
        time_signed_in,
        region_id,
        region_name,
        home_claim_id,
        home_claim_name,
        home_claim_region_id,
        skill_xp_json,
        claims_json,
        empire_memberships_json,
        equipment_json,
        inventory_json,
        snapshot_at,
        last_player_sync_at,
        last_equipment_sync_at
      ) VALUES (
        $character_id,
        $empire_id,
        $player_name,
        $rank_numeric,
        $rank_title,
        $total_xp,
        $donated_shards,
        $donated_empire_currency,
        $last_login_at,
        $time_played,
        $time_signed_in,
        $region_id,
        $region_name,
        $home_claim_id,
        $home_claim_name,
        $home_claim_region_id,
        $skill_xp_json,
        $claims_json,
        $empire_memberships_json,
        $equipment_json,
        $inventory_json,
        $snapshot_at,
        $last_player_sync_at,
        $last_equipment_sync_at
      )
      ON CONFLICT(character_id, empire_id) DO UPDATE SET
        player_name = excluded.player_name,
        rank_numeric = excluded.rank_numeric,
        rank_title = excluded.rank_title,
        total_xp = excluded.total_xp,
        donated_shards = excluded.donated_shards,
        donated_empire_currency = excluded.donated_empire_currency,
        last_login_at = excluded.last_login_at,
        time_played = excluded.time_played,
        time_signed_in = excluded.time_signed_in,
        region_id = excluded.region_id,
        region_name = excluded.region_name,
        home_claim_id = excluded.home_claim_id,
        home_claim_name = excluded.home_claim_name,
        home_claim_region_id = excluded.home_claim_region_id,
        skill_xp_json = excluded.skill_xp_json,
        claims_json = excluded.claims_json,
        empire_memberships_json = excluded.empire_memberships_json,
        equipment_json = excluded.equipment_json,
        inventory_json = excluded.inventory_json,
        snapshot_at = excluded.snapshot_at,
        last_player_sync_at = excluded.last_player_sync_at,
        last_equipment_sync_at = excluded.last_equipment_sync_at
    `;

    db.run(sql, row, function (err) {
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * Get all members for an empire from the local snapshot.
 */
function getEmpireMembers(empireId) {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT *
      FROM empire_members
      WHERE empire_id = ?
      ORDER BY rank_numeric ASC, player_name ASC
      `,
      [empireId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

/**
 * Get minimal sync metadata for an empire's members.
 *
 * IMPORTANT: We do NOT select last_equipment_sync_at here, to avoid errors
 * on older databases that don't have that column yet.
 */
function getMemberSyncMetadata(empireId) {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT character_id, empire_id, last_player_sync_at
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
}

module.exports = {
  upsertEmpireMember,
  getEmpireMembers,
  getMemberSyncMetadata,
};