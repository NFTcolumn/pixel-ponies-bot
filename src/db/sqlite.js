import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'pixel-ponies.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initializeDatabase() {
  console.log('🔧 Initializing SQLite database...');

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id TEXT PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      base_address TEXT,
      twitter_handle TEXT,
      twitter_follow_verified INTEGER DEFAULT 0,
      total_won REAL DEFAULT 0,
      races_won INTEGER DEFAULT 0,
      races_participated INTEGER DEFAULT 0,
      race_rewards_earned REAL DEFAULT 0,
      airdrop_received INTEGER DEFAULT 0,
      airdrop_amount REAL DEFAULT 0,
      referral_code TEXT UNIQUE,
      referred_by TEXT,
      referral_count INTEGER DEFAULT 0,
      referral_earnings REAL DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Races table
  db.exec(`
    CREATE TABLE IF NOT EXISTS races (
      race_id TEXT PRIMARY KEY,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      status TEXT DEFAULT 'upcoming' CHECK(status IN ('upcoming', 'betting_open', 'racing', 'finished')),
      horses TEXT, -- JSON string of horses array
      winner_horse_id INTEGER,
      winner_horse_name TEXT,
      prize_pool REAL DEFAULT 700,
      total_payout REAL DEFAULT 0,
      temporary_message_ids TEXT, -- JSON array
      permanent_message_ids TEXT, -- JSON array
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Race participants table (normalized from embedded array)
  db.exec(`
    CREATE TABLE IF NOT EXISTS race_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      race_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      horse_id INTEGER NOT NULL,
      horse_name TEXT NOT NULL,
      tweet_url TEXT,
      joined_at INTEGER DEFAULT (strftime('%s', 'now')),
      payout REAL DEFAULT 0,
      FOREIGN KEY (race_id) REFERENCES races(race_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
      UNIQUE(race_id, user_id)
    )
  `);

  // Temp selections table
  db.exec(`
    CREATE TABLE IF NOT EXISTS temp_selections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      race_id TEXT NOT NULL,
      horse_id INTEGER NOT NULL,
      horse_name TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      UNIQUE(user_id, race_id)
    )
  `);

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
    CREATE INDEX IF NOT EXISTS idx_races_status ON races(status);
    CREATE INDEX IF NOT EXISTS idx_races_start_time ON races(start_time);
    CREATE INDEX IF NOT EXISTS idx_race_participants_race ON race_participants(race_id);
    CREATE INDEX IF NOT EXISTS idx_race_participants_user ON race_participants(user_id);
    CREATE INDEX IF NOT EXISTS idx_temp_selections_user ON temp_selections(user_id);
    CREATE INDEX IF NOT EXISTS idx_temp_selections_race ON temp_selections(race_id);
  `);

  console.log('✅ SQLite database initialized');
}

// Auto-cleanup old temp selections (older than 2 hours)
export function cleanupOldTempSelections() {
  const twoHoursAgo = Math.floor(Date.now() / 1000) - 7200;
  const stmt = db.prepare('DELETE FROM temp_selections WHERE created_at < ?');
  const result = stmt.run(twoHoursAgo);
  if (result.changes > 0) {
    console.log(`🧹 Cleaned up ${result.changes} old temp selections`);
  }
}

// Run cleanup every hour
setInterval(cleanupOldTempSelections, 3600000);

export default db;
