// commands/members.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { getGuildEmpire } = require('../config/guildSettings');
const { getEmpireMembers } = require('../db/empireMembers');

function parseSkillJson(skillJson) {
  if (!skillJson) return {};
  try {
    return JSON.parse(skillJson);
  } catch {
    return {};
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('members')
    .setDescription('Show the Bitcraft empire members for this server'),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const { empireId, empireName } = getGuildEmpire(guildId);

    if (!empireId) {
      await interaction.reply({
        content:
          'No empire is configured for this server yet. Use `/set_empire` first.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: false });

    try {
      const members = await getEmpireMembers(empireId);

      if (!members.length) {
        await interaction.editReply(
          `No members found in the local snapshot for empire **${empireName || empireId}**.`
        );
        return;
      }

      // Limit output to avoid overly long messages; we can paginate later.
      const maxRows = 20;
      const rows = members.slice(0, maxRows);

      const lines = rows.map((m, idx) => {
        const rank = m.rank_title || `Rank ${m.rank_numeric ?? '-'}`;
        const xp = m.total_xp != null ? m.total_xp.toLocaleString() : '—';
        const lastLogin = m.last_login_at || 'unknown';
        const donatedEC =
          m.donated_empire_currency != null
            ? m.donated_empire_currency.toString()
            : '0';

        // Extract one or two top skills by level (if available)
        const skills = parseSkillJson(m.skill_xp_json);
        const skillEntries = Object.entries(skills);
        skillEntries.sort((a, b) => (b[1].level || 0) - (a[1].level || 0));
        const topSkills = skillEntries.slice(0, 2).map(
          ([name, data]) => `${name} ${data.level ?? '?'}`
        );
        const topSkillsStr = topSkills.length ? ` | Skills: ${topSkills.join(', ')}` : '';

        return `${idx + 1}. **${m.player_name}** — ${rank}, XP: ${xp}, Last login: ${lastLogin}, EC Donated: ${donatedEC}${topSkillsStr}`;
      });

      const description = lines.join('\n');

      const embed = new MessageEmbed()
        .setTitle(`Members of ${empireName || `Empire ${empireId}`}`)
        .setDescription(description)
        .setFooter({
          text:
            members[0]?.snapshot_at
              ? `Snapshot as of ${members[0].snapshot_at}`
              : 'Snapshot time unknown',
        });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Error in /members:', err);
      await interaction.editReply(
        'There was an error retrieving members from the local database.'
      );
    }
  },
};