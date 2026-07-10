// bitjitaItems.js
const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://bitjita.com';
const itemsPath = path.join(__dirname, 'data', 'items.json');

function fetchJson(pathname) {
  const url = `${BASE_URL}${pathname}`;
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (err) {
            reject(new Error(`Failed to parse JSON from ${url}: ${err.message}`));
          }
        });
      })
      .on('error', (err) => {
        reject(new Error(`Request failed for ${url}: ${err.message}`));
      });
  });
}

function loadLocalItems() {
  try {
    const raw = fs.readFileSync(itemsPath, 'utf8');
    const items = JSON.parse(raw);
    return items;
  } catch {
    return null;
  }
}

function saveLocalItems(catalog) {
  const dir = path.dirname(itemsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(itemsPath, JSON.stringify(catalog, null, 2), 'utf8');
}

async function fetchRemoteItems() {
  const data = await fetchJson('/api/items'); // Bitjita item list [web:19]
  let itemsArray = data;
  if (!Array.isArray(itemsArray)) {
    itemsArray = data.items || data.data || [];
  }
  if (!Array.isArray(itemsArray)) {
    throw new Error('Invalid items format from /api/items');
  }

  const catalog = {};
  for (const item of itemsArray) {
    const id = item.id;
    if (id == null) continue;
    catalog[String(id)] = {
      name: item.name || `Item ${id}`,
      tier: item.tier ?? null,
      tag: item.tag || null,
      rarity: item.rarity ?? null,
      iconAssetName: item.iconAssetName || null,
    };
  }
  return catalog;
}

async function ensureItemsCatalog() {
  const local = loadLocalItems();
  const localCount = local ? Object.keys(local).length : 0;

  let remote;
  try {
    remote = await fetchRemoteItems();
  } catch (err) {
    console.error('Failed to fetch remote item list:', err.message);
    if (local) {
      console.warn('Using existing local items.json');
      return local;
    }
    throw err;
  }

  const remoteCount = Object.keys(remote).length;

  if (!local || localCount !== remoteCount) {
    console.log(
      `Item list changed (local: ${localCount}, remote: ${remoteCount}). Updating items.json...`
    );
    saveLocalItems(remote);
    return remote;
  }

  console.log('Item list count unchanged; keeping existing items.json');
  return local;
}

module.exports = {
  ensureItemsCatalog,
};