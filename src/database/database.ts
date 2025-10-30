import sqlite3 from 'sqlite3';
import { config } from '../config';

export const db = new sqlite3.Database(config.dbFile, (err) => {
  if (err) {
    console.error('Could not connect to database', err);
  } else {
    console.log('Connected to SQLite database:', config.dbFile);
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS ads (
      id TEXT PRIMARY KEY,
      url TEXT,
      title TEXT,
      searchTerm TEXT,
      price INTEGER,
      created TEXT,
      lastUpdate TEXT,
      isActive INTEGER DEFAULT 1,
      missingCount INTEGER DEFAULT 0
    )
  `);

  db.run(`
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