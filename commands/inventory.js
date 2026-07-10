// commands/inventory.js (or inventy.js)
const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { getGuildEmpire } = require('../config/guildSettings');
const { getItemInfo } = require('../itemCatalog');
const { classifyCategory, createCategoryBuckets } = require('../config/categories');
const { loadEmpireSnapshot } = require('../empireCache');
const { flattenInventory } = require('../utils/inventoryUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Show a grouped summary of items across your empire claims')
    .addStringOption(option =>
      option
        .setName('tier')
        .setDescription('Tier filter (e.g., "3", "T3", "tier3")')
        .setRequired(false)
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

    const tierInput = interaction.options.getString('tier');
    let requestedTier = null;

    if (tierInput) {
      const match = tierInput.match(/(\d+)/);
      if (match) {
        requestedTier = parseInt(match[1], 10);
      } else {
        await interaction.editReply(
          'Could not parse tier from input. Please use formats like "3", "T3", or "tier3".'
        );
        return;
      }
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

      // Aggregate totals by itemId
      const itemTotals = new Map();
      for (const entry of entries) {
        itemTotals.set(
          entry.itemId,
          (itemTotals.get(entry.itemId) || 0) + entry.quantity
        );
      }

      if (itemTotals.size === 0) {
        await interaction.editReply(
          `No inventory items found for empire **${empireName || empireId}** (or inventories are empty/not accessible).`
        );
        return;
      }

      const categories = createCategoryBuckets();
      let anyItems = false;

      for (const [itemId, total] of itemTotals.entries()) {
        const info = getItemInfo(itemId);
        if (!info) continue;

        const tier = info.tier != null ? info.tier : null;

        if (requestedTier !== null && tier !== requestedTier) {
          continue;
        }

        const name = info.name || 'Unknown Item';
        const tag = info.tag || null;

        const categoryName = classifyCategory(tag, name);
        const bucketName = categories[categoryName] ? categoryName : 'Special & Rare';

        categories[bucketName].items.push({
          name,
          tier: tier ?? '?',
          total,
        });
        anyItems = true;
      }

      if (!anyItems) {
        const tierMsg = requestedTier !== null ? ` at Tier ${requestedTier}` : '';
        await interaction.editReply(
          `No inventory items found${tierMsg} for empire **${empireName || empireId}**.`
        );
        return;
      }

      // Sort items within each category by quantity descending
      for (const cat of Object.values(categories)) {
        cat.items.sort((a, b) => b.total - a.total);
      }

      const embeds = [];
      const titleSuffix = requestedTier !== null ? ` (Tier ${requestedTier})` : '';

      for (const [catName, cat] of Object.entries(categories)) {
        if (cat.items.length === 0) continue;

        const top = cat.items.slice(0, 15);
        const lines = top.map(item => `${item.name}: ${item.total}`);

        const embed = new MessageEmbed()
          .setTitle(`${catName}${titleSuffix} — ${empireName || empireId}`)
          .setColor(cat.color)
          .setDescription(lines.join('\n'));

        embeds.push(embed);
      }

      if (!embeds.length) {
        await interaction.editReply(
          `No categorized inventory items found for empire **${empireName || empireId}**.`
        );
        return;
      }

      await interaction.editReply({ embeds: embeds.slice(0, 10) });
    } catch (error) {
      console.error('Error in /inventory:', error);
      await interaction.editReply(
        'There was an error fetching inventories from Bitjita. Please try again later.'
      );
    }
  },
};