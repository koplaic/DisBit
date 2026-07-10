// autoSync.js
const { syncEmpireMembers } = require('./sync/empireMembersSync');
const { syncPlayerEquipmentForEmpire } = require('./sync/playerEquipmentSync');
const { syncClaimStations } = require('./sync/claimStationsSync');
const { getAllConfiguredEmpires } = require('./config/guildSettings');

// Default interval: 10 minutes (configurable via env)
const AUTO_SYNC_INTERVAL_MS =
  (process.env.MEMBER_SYNC_INTERVAL_MIN
    ? Number(process.env.MEMBER_SYNC_INTERVAL_MIN)
    : 10) * 60 * 1000;

function startAutoMemberSync() {
  // Run once on startup
  runMemberSyncCycle();

  // Then schedule
  setInterval(runMemberSyncCycle, AUTO_SYNC_INTERVAL_MS);
}

async function runMemberSyncCycle() {
  const empires = getAllConfiguredEmpires();

  if (!empires || !empires.length) {
    console.log('[MemberSync] No empires configured; skipping sync.');
    return;
  }

  console.log(`[MemberSync] Starting sync for ${empires.length} empire(s).`);

  const cycleStart = Date.now();

  for (const { empireId, empireName } of empires) {
    const label = empireName || empireId;

    try {
      console.log(`[MemberSync] Syncing members for empire ${label}...`);
      const count = await syncEmpireMembers(empireId);
      console.log(
        `[MemberSync] Synced ${count} member(s) for empire ${label}.`
      );
    } catch (err) {
      console.error(
        `[MemberSync] Error syncing members for empire ${label}:`,
        err
      );
    }

    try {
      console.log(
        `[MemberSync] Syncing player equipment/inventory for empire ${label}...`
      );
      const eqCount = await syncPlayerEquipmentForEmpire(empireId);
      console.log(
        `[MemberSync] Equipment/inventory sync processed ${eqCount} member(s) for empire ${label}.`
      );
    } catch (err) {
      console.error(
        `[MemberSync] Error syncing equipment for empire ${label}:`,
        err
      );
    }

    try {
      console.log(`[MemberSync] Syncing claim stations for empire ${label}...`);
      await syncClaimStations(empireId);
      console.log(
        `[MemberSync] Claim stations sync completed for empire ${label}.`
      );
    } catch (err) {
      console.error(
        `[MemberSync] Error syncing claim stations for empire ${label}:`,
        err
      );
    }
  }

  const durationSec = ((Date.now() - cycleStart) / 1000).toFixed(1);
  console.log(`[MemberSync] Sync cycle completed in ${durationSec}s.`);
}

module.exports = {
  startAutoMemberSync,
};