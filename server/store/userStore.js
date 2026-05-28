// 数据库初始化 - 使用 sql.js (WASM-based SQLite，无需编译)

import initSqlJs from 'sql.js';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { DATA_DIR } from '../config.js';

const DB_PATH = join(DATA_DIR, 'cladio.db');
let db = null;
let saveTimer = null;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS play_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    duration_played INTEGER,
    total_duration INTEGER,
    action TEXT,
    source TEXT
  );

  CREATE TABLE IF NOT EXISTS chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    intent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_type TEXT NOT NULL,
    tag_value TEXT NOT NULL,
    weight REAL DEFAULT 0.5,
    source TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tag_type, tag_value)
  );

  CREATE TABLE IF NOT EXISTS daily_stats (
    date DATE PRIMARY KEY,
    play_count INTEGER DEFAULT 0,
    total_duration INTEGER DEFAULT 0,
    top_genre TEXT,
    top_artist TEXT,
    weather TEXT
  );
`;

export async function initDB() {
  const SQL = await initSqlJs();

  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
    db.run(SCHEMA);
    saveDB();
  }

  console.log('Database initialized (sql.js)');
  return db;
}

export function getDB() {
  if (!db) throw new Error('Database not initialized. Call initDB() first.');
  return db;
}

// 延迟保存，避免频繁IO
export function saveDB() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!db) return;
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(DB_PATH, buffer);
  }, 1000);
}

// 兼容 better-sqlite3 的 prepare API
export function prepare(sql) {
  return {
    run(...params) {
      db.run(sql, params);
      saveDB();
      return this;
    },
    get(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
      }
      stmt.free();
      return undefined;
    },
    all(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    }
  };
}
