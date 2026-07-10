// experienceLevels.js
const fetch = require('node-fetch');

const BASE_URL = 'https://bitjita.com';
let levelsTable = null;

// Structure of /static/experience/levels.json is assumed like:
// [ { level: 1, xp: 0 }, { level: 2, xp: 83 }, ... ]
async function loadLevelsTable() {
  if (levelsTable) return levelsTable;

  const url = `${BASE_URL}/static/experience/levels.json`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Disbit (Bitcraft Discord bot)',
      'x-app-identifier': 'DisbitBot',
    },
  });

  if (!res.ok) {
    throw new Error(
      `Failed to load experience levels: ${res.status} ${res.statusText}`
    );
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error('Unexpected experience levels JSON format');
  }

  // Sort by xp ascending just in case
  levelsTable = data.slice().sort((a, b) => a.xp - b.xp);
  return levelsTable;
}

async function getLevelForXp(xp) {
  if (xp == null) return null;
  const table = await loadLevelsTable();

  // Find highest level where xpThreshold <= xp
  let level = 1;
  for (const entry of table) {
    if (xp >= entry.xp) {
      level = entry.level;
    } else {
      break;
    }
  }
  return level;
}

module.exports = {
  loadLevelsTable,
  getLevelForXp,
};