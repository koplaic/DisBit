// config/guildSettings.js

// Simple in-memory + JSON-backed mapping from Discord guilds to Bitjita empires.
// On startup we load from config/guildEmpires.json if it exists,
// and on each change we write back to that file.

const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'guildEmpires.json');

// Internal structure:
// guildEmpires: Map<guildId, { empireId: string, empireName: string | null }>
const guildEmpires = new Map();

// Load from JSON file on startup (if present)
function loadGuildEmpiresFromFile() {
  if (!fs.existsSync(CONFIG_FILE)) return;

  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      for (const entry of data) {
        if (!entry.guildId || !entry.empireId) continue;
        guildEmpires.set(entry.guildId, {
          empireId: String(entry.empireId),
          empireName: entry.empireName || null,
        });
      }
    }
    console.log(
      `[GuildSettings] Loaded ${guildEmpires.size} guild → empire mapping(s) from ${CONFIG_FILE}.`
    );
  } catch (err) {
    console.error('[GuildSettings] Failed to load guildEmpires.json:', err);
  }
}

// Persist current map to JSON file
function saveGuildEmpiresToFile() {
  const arr = [];
  for (const [guildId, value] of guildEmpires.entries()) {
    arr.push({
      guildId,
      empireId: value.empireId,
      empireName: value.empireName || null,
    });
  }

  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(arr, null, 2), 'utf8');
    console.log(
      `[GuildSettings] Saved ${arr.length} guild → empire mapping(s) to ${CONFIG_FILE}.`
    );
  } catch (err) {
    console.error('[GuildSettings] Failed to save guildEmpires.json:', err);
  }
}

// Initialize on module load
loadGuildEmpiresFromFile();

/**
 * Set the empire for a given guild.
 *
 * Used by /set_empire:
 *   setGuildEmpire(guildId, empireId, empireName)
 */
function setGuildEmpire(guildId, empireId, empireName) {
  if (!guildId || !empireId) {
    console.warn(
      '[GuildSettings] setGuildEmpire called with missing guildId or empireId.',
      { guildId, empireId }
    );
    return;
  }

  guildEmpires.set(guildId, {
    empireId: String(empireId),
    empireName: empireName || null,
  });

  saveGuildEmpiresToFile();
}

/**
 * Get the empire config for a specific guild.
 *
 * Returns { empireId, empireName } or { empireId: null, empireName: null } if none set.
 */
function getGuildEmpire(guildId) {
  return guildEmpires.get(guildId) || { empireId: null, empireName: null };
}

/**
 * Return a unique list of empires to sync.
 *
 * Used by autoSync; deduplicates by empireId in case multiple guilds share one empire.
 *
 * Output shape:
 * [
 *   { empireId: '6500896', empireName: 'Dream of Serenity' },
 *   ...
 * ]
 */
function getAllConfiguredEmpires() {
  const seen = new Map();

  for (const [, value] of guildEmpires.entries()) {
    if (!value.empireId) continue;
    if (!seen.has(value.empireId)) {
      seen.set(value.empireId, {
        empireId: value.empireId,
        empireName: value.empireName,
      });
    }
  }

  return Array.from(seen.values());
}

module.exports = {
  setGuildEmpire,
  getGuildEmpire,
  getAllConfiguredEmpires,
};
