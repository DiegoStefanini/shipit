import path from 'path';
import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { config } from '../config.js';

const dbPath = path.join(config.dataDir, 'shipit.db');
const db: DatabaseType = new Database(dbPath);
db.pragma('journal_mode = WAL');

export default db;
