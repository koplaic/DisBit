// commands/set-empire.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const {
  getEmpireById,
  searchEmpiresByName,
  parseEmpireIdFromInput,
} = require('../bitjitaClient');
const {
  setGuildEmpire,
} = require('../config/guildSettings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set_empire')
    .setDescription('Set the Bitcraft empire for this server (name, URL, or ID)')
    .addStringOption(option =>
      option
        .setName('input')
        .setDescription('Empire name (e.g. "Dream of Serenity") or Bitjita URL/ID')
        .setRequired(true)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const input = interaction.options.getString('input');

    await interaction.deferReply({ ephemeral: true });

    try {
      // 1) Try to parse as URL or numeric ID
      const parsedId = parseEmpireIdFromInput(input);

      if (parsedId) {
        const empireData = await getEmpireById(parsedId);

        const empireName =
          empireData.name ||
          empireData.empireName ||
          'Unknown Empire';

        setGuildEmpire(guildId, parsedId, empireName);

        await interaction.editReply(
          `Empire for this server set to "${empireName}" (ID: ${parsedId}).`
        );
        return;
      }

      // 2) Otherwise treat input as a name and search
      const empires = await searchEmpiresByName(input);

      if (!empires || empires.length === 0) {
        await interaction.editReply(`No empires found matching "${input}".`);
        return;
      }

      // For now, pick the first match
      const empire = empires[0];

      const empireId = empire.id || empire.entityId || empire.empireId || null;
      const empireName = empire.name || input;

      if (!empireId) {
        await interaction.editReply(
          `Found an empire named "${empireName}", but could not determine its ID from the API response.`
        );
        return;
      }

      setGuildEmpire(guildId, empireId, empireName);

      await interaction.editReply(
        `Empire for this server set to "${empireName}" (ID: ${empireId}).`
      );
    } catch (error) {
      console.error('Error in /set_empire:', error);
      await interaction.editReply(
        'There was an error contacting Bitjita or parsing the empire data. Please try again later.'
      );
    }
  },
};