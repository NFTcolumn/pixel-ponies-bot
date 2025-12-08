import db from '../db/sqlite.js';

class Race {
  // Create a new race
  static create(raceData) {
    const stmt = db.prepare(`
      INSERT INTO races (
        race_id, start_time, end_time, status, horses, winner_horse_id,
        winner_horse_name, prize_pool, total_payout, temporary_message_ids,
        permanent_message_ids
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      raceData.raceId,
      this._toTimestamp(raceData.startTime),
      raceData.endTime ? this._toTimestamp(raceData.endTime) : null,
      raceData.status || 'upcoming',
      JSON.stringify(raceData.horses || []),
      raceData.winner?.horseId || null,
      raceData.winner?.horseName || null,
      raceData.prizePool || 700,
      raceData.totalPayout || 0,
      JSON.stringify(raceData.temporaryMessageIds || []),
      JSON.stringify(raceData.permanentMessageIds || [])
    );

    // Insert participants if provided
    if (raceData.participants && raceData.participants.length > 0) {
      const participantStmt = db.prepare(`
        INSERT INTO race_participants (
          race_id, user_id, username, horse_id, horse_name, tweet_url, joined_at, payout
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMany = db.transaction((participants) => {
        for (const p of participants) {
          participantStmt.run(
            raceData.raceId,
            p.userId,
            p.username,
            p.horseId,
            p.horseName,
            p.tweetUrl || null,
            this._toTimestamp(p.joinedAt || new Date()),
            p.payout || 0
          );
        }
      });

      insertMany(raceData.participants);
    }

    return this.findById(raceData.raceId);
  }

  // Find race by ID
  static findById(raceId) {
    const stmt = db.prepare('SELECT * FROM races WHERE race_id = ?');
    const race = stmt.get(raceId);

    if (!race) return null;

    // Get participants
    const participantStmt = db.prepare('SELECT * FROM race_participants WHERE race_id = ?');
    const participants = participantStmt.all(raceId);

    return this._transformRace(race, participants);
  }

  // Find one race by criteria
  static findOne(criteria) {
    const keys = Object.keys(criteria);
    if (keys.length === 0) return null;

    const conditions = keys.map(key => `${this._toSnakeCase(key)} = ?`).join(' AND ');
    const values = keys.map(key => criteria[key]);

    const stmt = db.prepare(`SELECT * FROM races WHERE ${conditions} LIMIT 1`);
    const race = stmt.get(...values);

    if (!race) return null;

    const participantStmt = db.prepare('SELECT * FROM race_participants WHERE race_id = ?');
    const participants = participantStmt.all(race.race_id);

    return this._transformRace(race, participants);
  }

  // Find all races with criteria
  static findAll(criteria = {}, options = {}) {
    let query = 'SELECT * FROM races';
    const values = [];

    if (Object.keys(criteria).length > 0) {
      const conditions = Object.keys(criteria).map(key => {
        values.push(criteria[key]);
        return `${this._toSnakeCase(key)} = ?`;
      }).join(' AND ');
      query += ` WHERE ${conditions}`;
    }

    // Add sorting
    if (options.sort) {
      const sortField = Object.keys(options.sort)[0];
      const sortOrder = options.sort[sortField] === -1 ? 'DESC' : 'ASC';
      query += ` ORDER BY ${this._toSnakeCase(sortField)} ${sortOrder}`;
    }

    // Add limit
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    const stmt = db.prepare(query);
    const races = stmt.all(...values);

    // Get all race IDs
    const raceIds = races.map(r => r.race_id);

    // Get all participants for these races
    let participantsByRace = {};
    if (raceIds.length > 0) {
      const placeholders = raceIds.map(() => '?').join(',');
      const participantStmt = db.prepare(`
        SELECT * FROM race_participants WHERE race_id IN (${placeholders})
      `);
      const allParticipants = participantStmt.all(...raceIds);

      // Group by race_id
      for (const p of allParticipants) {
        if (!participantsByRace[p.race_id]) {
          participantsByRace[p.race_id] = [];
        }
        participantsByRace[p.race_id].push(p);
      }
    }

    return races.map(race => this._transformRace(race, participantsByRace[race.race_id] || []));
  }

  // Update race
  static updateById(raceId, updates) {
    const keys = Object.keys(updates).filter(k => k !== 'participants' && k !== 'winner');

    if (keys.length > 0) {
      const setClauses = keys.map(key => `${this._toSnakeCase(key)} = ?`).join(', ');
      const values = keys.map(key => {
        const val = updates[key];
        if (key === 'horses' || key === 'temporaryMessageIds' || key === 'permanentMessageIds') {
          return JSON.stringify(val);
        }
        if (key === 'startTime' || key === 'endTime') {
          return this._toTimestamp(val);
        }
        return val;
      });

      const stmt = db.prepare(`UPDATE races SET ${setClauses} WHERE race_id = ?`);
      stmt.run(...values, raceId);
    }

    // Update winner if provided
    if (updates.winner) {
      const winnerStmt = db.prepare(`
        UPDATE races SET winner_horse_id = ?, winner_horse_name = ? WHERE race_id = ?
      `);
      winnerStmt.run(updates.winner.horseId, updates.winner.horseName, raceId);
    }

    return this.findById(raceId);
  }

  // Add participant to race
  static addParticipant(raceId, participant) {
    const stmt = db.prepare(`
      INSERT INTO race_participants (
        race_id, user_id, username, horse_id, horse_name, tweet_url, payout
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(race_id, user_id) DO UPDATE SET
        horse_id = excluded.horse_id,
        horse_name = excluded.horse_name,
        tweet_url = excluded.tweet_url
    `);

    stmt.run(
      raceId,
      participant.userId,
      participant.username,
      participant.horseId,
      participant.horseName,
      participant.tweetUrl || null,
      participant.payout || 0
    );

    return this.findById(raceId);
  }

  // Update participant payout
  static updateParticipantPayout(raceId, userId, payout) {
    const stmt = db.prepare(`
      UPDATE race_participants SET payout = ? WHERE race_id = ? AND user_id = ?
    `);
    stmt.run(payout, raceId, userId);
  }

  // Count races
  static count(criteria = {}) {
    let query = 'SELECT COUNT(*) as count FROM races';
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

  // Delete race
  static deleteById(raceId) {
    const stmt = db.prepare('DELETE FROM races WHERE race_id = ?');
    return stmt.run(raceId);
  }

  // Delete many races
  static deleteMany(criteria) {
    const keys = Object.keys(criteria);
    if (keys.length === 0) return { deletedCount: 0 };

    const conditions = keys.map(key => `${this._toSnakeCase(key)} = ?`).join(' AND ');
    const values = keys.map(key => criteria[key]);

    const stmt = db.prepare(`DELETE FROM races WHERE ${conditions}`);
    const result = stmt.run(...values);
    return { deletedCount: result.changes };
  }

  // Transform database row to camelCase object
  static _transformRace(race, participants = []) {
    if (!race) return null;

    const transformed = {
      raceId: race.race_id,
      startTime: new Date(race.start_time * 1000),
      endTime: race.end_time ? new Date(race.end_time * 1000) : null,
      status: race.status,
      horses: JSON.parse(race.horses || '[]'),
      winner: race.winner_horse_id ? {
        horseId: race.winner_horse_id,
        horseName: race.winner_horse_name
      } : null,
      participants: participants.map(p => ({
        userId: p.user_id,
        username: p.username,
        horseId: p.horse_id,
        horseName: p.horse_name,
        tweetUrl: p.tweet_url,
        joinedAt: new Date(p.joined_at * 1000),
        payout: p.payout
      })),
      prizePool: race.prize_pool,
      totalPayout: race.total_payout,
      temporaryMessageIds: JSON.parse(race.temporary_message_ids || '[]'),
      permanentMessageIds: JSON.parse(race.permanent_message_ids || '[]')
    };

    return transformed;
  }

  // Convert Date to Unix timestamp
  static _toTimestamp(date) {
    if (!date) return null;
    if (typeof date === 'number') return Math.floor(date / 1000);
    return Math.floor(new Date(date).getTime() / 1000);
  }

  // Convert camelCase to snake_case
  static _toSnakeCase(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

export default Race;
