// commands/character.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { getGuildEmpire } = require('../config/guildSettings');
const { getEmpireMembers } = require('../db/empireMembers');

function parseJsonSafe(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('character')
    .setDescription('Show detailed profile for a member')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Exact or partial character name')
        .setRequired(true)
    ),

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

    const nameQuery = interaction.options.getString('name');
    await interaction.deferReply({ ephemeral: false });

    try {
      const members = await getEmpireMembers(empireId);
      if (!members.length) {
        await interaction.editReply(
          `No members found for empire **${empireName || empireId}**.`
        );
        return;
      }

      const lowerQuery = nameQuery.toLowerCase();

      // First try exact match, then partial match
      let member =
        members.find(m => m.player_name.toLowerCase() === lowerQuery) ||
        members.find(m => m.player_name.toLowerCase().includes(lowerQuery));

      if (!member) {
        await interaction.editReply(
          `No member found matching "${nameQuery}" in ${empireName || `Empire ${empireId}`}.`
        );
        return;
      }

      const skills = parseJsonSafe(member.skill_xp_json) || {};
      const skillEntries = Object.entries(skills);
      skillEntries.sort((a, b) => (b[1].level || 0) - (a[1].level || 0));
      const topSkills = skillEntries.slice(0, 6);

      const claims = parseJsonSafe(member.claims_json) || [];
      const memberships = parseJsonSafe(member.empire_memberships_json) || [];

      const rank = member.rank_title || `Rank ${member.rank_numeric ?? '-'}`;
      const xp = member.total_xp != null ? member.total_xp.toLocaleString() : '—';
      const lastLogin = member.last_login_at || 'unknown';
      const timePlayed = member.time_played != null ? `${Math.round(member.time_played / 3600)}h` : 'unknown';
      const donatedEC =
        member.donated_empire_currency != null
          ? member.donated_empire_currency.toString()
          : '0';

      const embed = new MessageEmbed()
        .setTitle(`Character: ${member.player_name}`)
        .setDescription(
          `Empire: ${empireName || `Empire ${empireId}`}\nRank: ${rank}\nTotal XP: ${xp}\nLast login: ${lastLogin}\nTime played: ${timePlayed}\nEmpire currency donated: ${donatedEC}`
        );

      if (topSkills.length) {
        const skillLines = topSkills.map(([name, data]) => {
          const level = data.level ?? '?';
          const skillXp = data.xp != null ? data.xp.toLocaleString() : '—';
          return `${name}: level ${level} (${skillXp} XP)`;
        });
        embed.addField('Top Skills', skillLines.join('\n'), false);
      }

      if (claims.length) {
        const claimLines = claims.slice(0, 5).map(c => {
          const perms = c.memberPermissions || {};
          const flags = [];
          if (perms.buildPermission) flags.push('build');
          if (perms.inventoryPermission) flags.push('inventory');
          if (perms.officerPermission) flags.push('officer');
          if (perms.coOwnerPermission) flags.push('co-owner');
          const flagsStr = flags.length ? ` [${flags.join(', ')}]` : '';
          return `${c.name || 'Unknown claim'}${flagsStr}`;
        });
        embed.addField('Claims', claimLines.join('\n'), false);
      }

      if (memberships.length > 1) {
        const otherEmpires = memberships
          .filter(e => String(e.empireEntityId) !== String(empireId))
          .map(e => e.empireName || e.empireEntityId);
        if (otherEmpires.length) {
          embed.addField(
            'Other Empires',
            otherEmpires.join(', '),
            false
          );
        }
      }

      if (member.snapshot_at) {
        embed.setFooter({
          text: `Snapshot as of ${member.snapshot_at}`,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Error in /character:', err);
      await interaction.editReply(
        'There was an error retrieving character data from the local database.'
      );
    }
  },
};