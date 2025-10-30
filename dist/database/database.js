"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const config_1 = require("../config");
exports.db = new sqlite3_1.default.Database(config_1.config.dbFile, (err) => {
    if (err) {
        console.error('Could not connect to database', err);
    }
    else {
        console.log('Connected to SQLite database:', config_1.config.dbFile);
    }
});
exports.db.serialize(() => {
    exports.db.run(`
    CREATE TABLE IF NOT EXISTS ads (
      id TEXT PRIMARY KEY,
      url TEXT,
      title TEXT,
      searchTerm TEXT,
      price INTEGER,
      created TEXT,
      lastUpdate TEXT,
      isActive INTEGER DEFAULT 1
    )
  `);
    exports.db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT,
      adsFound INTEGER,
      averagePrice REAL,
      minPrice INTEGER,
      maxPrice INTEGER,
      created TEXT
    )
  `);
});
