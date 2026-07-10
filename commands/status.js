// commands/status.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const {
  getEmpireById,
  getEmpireClaims,
} = require('../bitjitaClient');
const {
  getGuildEmpire,
} = require('../config/guildSettings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show a basic status summary for the configured empire'),

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

    try {
      // Fetch empire details and claims
      const empireData = await getEmpireById(empireId);
      const claims = await getEmpireClaims(empireId);

      // Extract empire stats from the JSON structure:
      // { empire: { ... }, members: [...], count: N }
      const empire = empireData.empire || {};

      const name = empire.name || empireName || 'Unknown Empire';
      const numClaims = empire.numClaims || 0;
      const hexiteEnergy = empire.empireCurrencyTreasury || '0';
      const memberCount = empireData.count || (empireData.members?.length || 0);
      const capitalClaimName = empire.capitalClaimName || 'Unknown';
      const capitalRegionName = empire.capitalRegionName || 'Unknown';
      const territoryChunks = empire.territoryChunks || 0;

      // Build a rich status message
      let message = `Empire: **${name}** (ID: ${empireId})\n`;
      message += `Members: **${memberCount}** | Claims: **${numClaims}** | Territory Chunks: **${territoryChunks}**\n`;
      message += `Hexite Energy: **${hexiteEnergy}**\n`;
      message += `Capital: **${capitalClaimName}** (${capitalRegionName})\n`;

      // Optionally show a few claims if they exist
      let claimList = claims;
      if (!Array.isArray(claimList)) {
        // If claims are under a field like { claims: [...] }
        claimList = claimList.claims || claimList.data || [];
      }

      if (Array.isArray(claimList) && claimList.length > 0) {
        const firstFew = claimList.slice(0, 5);
        message += '\nSome claims:\n';
        for (const claim of firstFew) {
          const claimName = claim.name || 'Unknown Claim';
          const region = claim.regionName || claim.region || 'Unknown Region';
          message += `- ${claimName} (${region})\n`;
        }
        if (claimList.length > firstFew.length) {
          message += `...and ${claimList.length - firstFew.length} more.`;
        }
      }

      await interaction.editReply(message);
    } catch (error) {
      console.error('Error in /status:', error);
      await interaction.editReply(
        'There was an error fetching empire status from Bitjita. Please try again later.'
      );
    }
  },
};