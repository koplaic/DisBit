// db/claimStations.js
const db = require('./sqlite');

// Initialize table
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS claim_stations (
      claim_id TEXT NOT NULL,
      building_id TEXT NOT NULL,
      empire_id TEXT,
      station_type TEXT,   -- e.g. 'Smithing', 'Carpentry'
      station_tier INTEGER,
      name TEXT,
      region_id INTEGER,
      snapshot_at TEXT NOT NULL,
      PRIMARY KEY (building_id)
    )
  `);
});

function upsertClaimStation(row) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO claim_stations (
        claim_id,
        building_id,
        empire_id,
        station_type,
        station_tier,
        name,
        region_id,
        snapshot_at
      ) VALUES (
        $claim_id,
        $building_id,
        $empire_id,
        $station_type,
        $station_tier,
        $name,
        $region_id,
        $snapshot_at
      )
      ON CONFLICT(building_id) DO UPDATE SET
        claim_id = excluded.claim_id,
        empire_id = excluded.empire_id,
        station_type = excluded.station_type,
        station_tier = excluded.station_tier,
        name = excluded.name,
        region_id = excluded.region_id,
        snapshot_at = excluded.snapshot_at
    `;

    db.run(sql, row, function (err) {
      if (err) return reject(err);
      resolve();
    });
  });
}

function getStationsForEmpire(empireId) {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT *
      FROM claim_stations
      WHERE empire_id = ?
      ORDER BY claim_id, station_type, station_tier
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
  upsertClaimStation,
  getStationsForEmpire,
};