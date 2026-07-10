// itemCatalog.js
const fs = require('fs');
const path = require('path');

const itemsPath = path.join(__dirname, 'data', 'items.json');

let items = {};

function loadFromFileIfEmpty() {
  if (Object.keys(items).length > 0) return;
  try {
    const raw = fs.readFileSync(itemsPath, 'utf8');
    items = JSON.parse(raw);
    console.log(`Loaded ${Object.keys(items).length} items from items.json (fallback).`);
  } catch (e) {
    console.warn('Could not load data/items.json; item names will be IDs only.', e.message);
  }
}

function loadItemCatalog(newItems) {
  items = newItems || {};
  console.log(`Item catalog loaded into memory: ${Object.keys(items).length} items.`);
}

function getItemInfo(itemId) {
  if (!items || Object.keys(items).length === 0) {
    loadFromFileIfEmpty();
  }
  return items[String(itemId)] || null;
}

function getItemName(itemId) {
  const info = getItemInfo(itemId);
  return info ? info.name : `Item ${itemId}`;
}

module.exports = {
  loadItemCatalog,
  getItemInfo,
  getItemName,
};