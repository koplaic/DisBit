// db/sqlite.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// SQLite file will be created in the db folder as bot-data.sqlite
const dbPath = path.join(__dirname, 'bot-data.sqlite');
const db = new sqlite3.Database(dbPath);

module.exports = db;