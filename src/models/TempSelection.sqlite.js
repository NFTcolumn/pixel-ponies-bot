import db from '../db/sqlite.js';

class TempSelection {
  // Create a new temp selection
  static create(selectionData) {
    const stmt = db.prepare(`
      INSERT INTO temp_selections (user_id, race_id, horse_id, horse_name)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, race_id) DO UPDATE SET
        horse_id = excluded.horse_id,
        horse_name = excluded.horse_name,
        created_at = strftime('%s', 'now')
    `);

    stmt.run(
      selectionData.userId,
      selectionData.raceId,
      selectionData.horseId,
      selectionData.horseName
    );

    return this.findOne({
      userId: selectionData.userId,
      raceId: selectionData.raceId
    });
  }

  // Find one selection by criteria
  static findOne(criteria) {
    const keys = Object.keys(criteria);
    if (keys.length === 0) return null;

    const conditions = keys.map(key => `${this._toSnakeCase(key)} = ?`).join(' AND ');
    const values = keys.map(key => criteria[key]);

    const stmt = db.prepare(`SELECT * FROM temp_selections WHERE ${conditions} LIMIT 1`);
    const selection = stmt.get(...values);

    return selection ? this._transformSelection(selection) : null;
  }

  // Find all selections by criteria
  static findAll(criteria = {}) {
    let query = 'SELECT * FROM temp_selections';
    const values = [];

    if (Object.keys(criteria).length > 0) {
      const conditions = Object.keys(criteria).map(key => {
        values.push(criteria[key]);
        return `${this._toSnakeCase(key)} = ?`;
      }).join(' AND ');
      query += ` WHERE ${conditions}`;
    }

    const stmt = db.prepare(query);
    const selections = stmt.all(...values);

    return selections.map(s => this._transformSelection(s));
  }

  // Delete one selection
  static deleteOne(criteria) {
    const keys = Object.keys(criteria);
    if (keys.length === 0) return { deletedCount: 0 };

    const conditions = keys.map(key => `${this._toSnakeCase(key)} = ?`).join(' AND ');
    const values = keys.map(key => criteria[key]);

    const stmt = db.prepare(`DELETE FROM temp_selections WHERE ${conditions}`);
    const result = stmt.run(...values);

    return { deletedCount: result.changes };
  }

  // Delete many selections
  static deleteMany(criteria) {
    const keys = Object.keys(criteria);
    if (keys.length === 0) {
      // Delete all if no criteria
      const stmt = db.prepare('DELETE FROM temp_selections');
      const result = stmt.run();
      return { deletedCount: result.changes };
    }

    const conditions = keys.map(key => `${this._toSnakeCase(key)} = ?`).join(' AND ');
    const values = keys.map(key => criteria[key]);

    const stmt = db.prepare(`DELETE FROM temp_selections WHERE ${conditions}`);
    const result = stmt.run(...values);

    return { deletedCount: result.changes };
  }

  // Count selections
  static count(criteria = {}) {
    let query = 'SELECT COUNT(*) as count FROM temp_selections';
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

  // Transform database row to camelCase object
  static _transformSelection(selection) {
    if (!selection) return null;

    return {
      id: selection.id,
      userId: selection.user_id,
      raceId: selection.race_id,
      horseId: selection.horse_id,
      horseName: selection.horse_name,
      createdAt: new Date(selection.created_at * 1000)
    };
  }

  // Convert camelCase to snake_case
  static _toSnakeCase(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

export default TempSelection;
