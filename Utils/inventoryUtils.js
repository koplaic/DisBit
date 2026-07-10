// utils/inventoryUtils.js

function flattenInventory(snapshot) {
  const { claims, buildingsByClaimId } = snapshot;
  const entries = [];

  if (!claims || !Array.isArray(claims)) return entries;

  for (const claim of claims) {
    const claimId = claim.entityId || claim.claimId || claim.id;
    if (!claimId) continue;

    const claimName =
      claim.name ||
      claim.claimName ||
      claim.claimNickname ||
      `Claim ${claimId}`;

    const buildings = buildingsByClaimId?.[claimId] || [];
    for (const building of buildings) {
      const buildingId = building.entityId || building.id || '?';

      const buildingName =
        building.buildingNickname ||
        building.buildingName ||
        building.buildingNameRough ||
        `Building ${buildingId}`;

      const invSlots = building.inventory || [];
      for (const slot of invSlots) {
        const contents = slot.contents;
        if (!contents) continue;

        const itemType = contents.item_type || contents.itemtype;
        if (itemType && itemType !== 'item') continue;

        const rawItemId = contents.item_id ?? contents.itemid;
        const quantity = Number(contents.quantity || 0);
        if (!rawItemId || !quantity) continue;

        entries.push({
          claimName,
          buildingName,
          itemId: String(rawItemId),
          quantity,
        });
      }
    }
  }

  return entries;
}

module.exports = {
  flattenInventory,
};