import db from '../db/sqlite.js';

class User {
  // Create a new user
  static create(userData) {
    const stmt = db.prepare(`
      INSERT INTO users (
        telegram_id, username, first_name, last_name, base_address,
        twitter_handle, twitter_follow_verified, total_won, races_won,
        races_participated, race_rewards_earned, airdrop_received,
        airdrop_amount, referral_code, referred_by, referral_count,
        referral_earnings
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      userData.telegramId,
      userData.username || null,
      userData.firstName || null,
      userData.lastName || null,
      userData.baseAddress || null,
      userData.twitterHandle || null,
      userData.twitterFollowVerified ? 1 : 0,
      userData.totalWon || 0,
      userData.racesWon || 0,
      userData.racesParticipated || 0,
      userData.raceRewardsEarned || 0,
      userData.airdropReceived ? 1 : 0,
      userData.airdropAmount || 0,
      userData.referralCode || null,
      userData.referredBy || null,
      userData.referralCount || 0,
      userData.referralEarnings || 0
    );

    return this.findById(userData.telegramId);
  }

  // Find user by telegram ID
  static findById(telegramId) {
    const stmt = db.prepare('SELECT * FROM users WHERE telegram_id = ?');
    const user = stmt.get(telegramId);
    return user ? this._transformUser(user) : null;
  }

  // Find user by referral code
  static findByReferralCode(referralCode) {
    const stmt = db.prepare('SELECT * FROM users WHERE referral_code = ?');
    const user = stmt.get(referralCode);
    return user ? this._transformUser(user) : null;
  }

  // Find one user by criteria
  static findOne(criteria) {
    const keys = Object.keys(criteria);
    if (keys.length === 0) return null;

    const conditions = keys.map(key => `${this._toSnakeCase(key)} = ?`).join(' AND ');
    const values = keys.map(key => criteria[key]);

    const stmt = db.prepare(`SELECT * FROM users WHERE ${conditions}`);
    const user = stmt.get(...values);
    return user ? this._transformUser(user) : null;
  }

  // Update user
  static updateById(telegramId, updates) {
    const keys = Object.keys(updates);
    if (keys.length === 0) return null;

    const setClauses = keys.map(key => `${this._toSnakeCase(key)} = ?`).join(', ');
    const values = keys.map(key => {
      const val = updates[key];
      if (typeof val === 'boolean') return val ? 1 : 0;
      return val;
    });

    const stmt = db.prepare(`UPDATE users SET ${setClauses} WHERE telegram_id = ?`);
    stmt.run(...values, telegramId);

    return this.findById(telegramId);
  }

  // Find all users (with optional criteria)
  static findAll(criteria = {}) {
    let query = 'SELECT * FROM users';
    const values = [];

    if (Object.keys(criteria).length > 0) {
      const conditions = Object.keys(criteria).map(key => {
        values.push(criteria[key]);
        return `${this._toSnakeCase(key)} = ?`;
      }).join(' AND ');
      query += ` WHERE ${conditions}`;
    }

    const stmt = db.prepare(query);
    const users = stmt.all(...values);
    return users.map(user => this._transformUser(user));
  }

  // Count users
  static count(criteria = {}) {
    let query = 'SELECT COUNT(*) as count FROM users';
    const values = [];

    if (Object.keys(criteria).length > 0) {
      const conditions = Object.keys(criteria).map(key => {
        values.push(criteria[key]);
        return `${this._toSnakeCase(key)} = ?`;
      }).join(' AND ');
      query += ` WHERE ${conditions}`;
    }

    const stmt = db.prepare(query);
    return stmt.get(...values).count;
  }

  // Delete user
  static deleteById(telegramId) {
    const stmt = db.prepare('DELETE FROM users WHERE telegram_id = ?');
    return stmt.run(telegramId);
  }

  // Transform database row to camelCase object
  static _transformUser(user) {
    if (!user) return null;
    return {
      telegramId: user.telegram_id,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      baseAddress: user.base_address,
      twitterHandle: user.twitter_handle,
      twitterFollowVerified: Boolean(user.twitter_follow_verified),
      totalWon: user.total_won,
      racesWon: user.races_won,
      racesParticipated: user.races_participated,
      raceRewardsEarned: user.race_rewards_earned,
      airdropReceived: Boolean(user.airdrop_received),
      airdropAmount: user.airdrop_amount,
      referralCode: user.referral_code,
      referredBy: user.referred_by,
      referralCount: user.referral_count,
      referralEarnings: user.referral_earnings,
      createdAt: new Date(user.created_at * 1000)
    };
  }

  // Convert camelCase to snake_case
  static _toSnakeCase(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

export default User;
