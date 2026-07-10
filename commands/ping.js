// commands/ping.js
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong! (from Disbit)'),

  async execute(interaction) {
    await interaction.reply('Pong! (from Disbit, slash command)');
  },
};