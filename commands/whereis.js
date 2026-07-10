// commands/whereis.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { getGuildEmpire } = require('../config/guildSettings');
const { getItemInfo } = require('../itemCatalog');
const { classifyCategory, createCategoryBuckets } = require('../config/categories');
const { loadEmpireSnapshot } = require('../empireCache');
const { flattenInventory } = require('../utils/inventoryUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whereis')
    .setDescription('Find where specific items are stored across your empire claims')
    .addStringOption(option =>
      option
        .setName('item')
        .setDescription('Item name (or part of it)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    await interaction.deferReply({ ephemeral: false });

    const { empireId, empireName } = getGuildEmpire(guildId);

    if (!empireId) {
      await interaction.editReply(
        'No empire is configured for this server yet. Use `/set_empire` first.'
      );
      return;
    }

    const searchText = interaction.options.getString('item')?.trim();
    if (!searchText) {
      await interaction.editReply('Please provide an item name or part of a name.');
      return;
    }

    try {
      const snapshot = await loadEmpireSnapshot(empireId);
      const entries = flattenInventory(snapshot);

      if (!entries.length) {
        await interaction.editReply(
          `No inventory items found for empire **${empireName || empireId}** (or inventories are empty/not accessible).`
        );
        return;
      }

      // Discover which item IDs are present
      const itemIdsPresent = new Set(entries.map(e => e.itemId));

      // Find catalog items whose names match the search text
      const loweredSearch = searchText.toLowerCase();
      const matchedItems = [];

      for (const id of itemIdsPresent) {
        const info = getItemInfo(id);
        if (!info || !info.name) continue;

        if (info.name.toLowerCase().includes(loweredSearch)) {
          matchedItems.push({ id, info });
        }
      }

      if (!matchedItems.length) {
        await interaction.editReply(
          `No items matching "${searchText}" were found in the current empire inventory.`
        );
        return;
      }

      const categories = createCategoryBuckets();

      // Map itemId -> { info, locations: [] }
      const locationsByItemId = new Map();
      for (const match of matchedItems) {
        locationsByItemId.set(match.id, {
          info: match.info,
          locations: [],
        });
      }

      // Fill locations using the flat entries
      for (const entry of entries) {
        if (!locationsByItemId.has(entry.itemId)) continue;

        const record = locationsByItemId.get(entry.itemId);
        record.locations.push({
          claimName: entry.claimName,
          buildingName: entry.buildingName,
          quantity: entry.quantity,
        });
      }

      // Place each item into its category with summarized locations
      for (const [itemId, data] of locationsByItemId.entries()) {
        if (!data.locations.length) continue;

        const info = data.info;
        const name = info.name || 'Unknown Item';
        const tier = info.tier != null ? info.tier : '?';
        const tag = info.tag || null;

        // Group locations by claim+building and sum quantities
        const grouped = new Map(); // "claim|building" -> total
        for (const loc of data.locations) {
          const key = `${loc.claimName}|${loc.buildingName}`;
          grouped.set(key, (grouped.get(key) || 0) + loc.quantity);
        }

        const locations = [];
        for (const [key, total] of grouped.entries()) {
          const [claimName, buildingName] = key.split('|');
          locations.push({ claimName, buildingName, total });
        }

        const categoryName = classifyCategory(tag, name);
        if (!categories[categoryName]) continue;

        categories[categoryName].items.push({
          name,
          tier,
          locations,
        });
      }

      const embeds = [];

      for (const [catName, cat] of Object.entries(categories)) {
        if (!cat.items.length) continue;

        const topItems = cat.items.slice(0, 5);
        const lines = [];

        for (const item of topItems) {
          lines.push(`**${item.name} (Tier ${item.tier})**`);

          const topLocs = item.locations
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);

          for (const loc of topLocs) {
            lines.push(
              `• ${loc.claimName} — ${loc.buildingName}: ${loc.total}`
            );
          }

          lines.push('');
        }

        const embed = new MessageEmbed()
          .setTitle(`${catName} — ${empireName || empireId}`)
          .setColor(cat.color)
          .setDescription(lines.join('\n'));

        embeds.push(embed);
      }

      if (!embeds.length) {
        await interaction.editReply(
          `No stored quantities of items matching "${searchText}" were found in this empire's claims.`
        );
        return;
      }

      await interaction.editReply({ embeds: embeds.slice(0, 10) });
    } catch (error) {
      console.error('Error in /whereis:', error);
      await interaction.editReply(
        'There was an error fetching item locations from Bitjita. Please try again later.'
      );
    }
  },
};