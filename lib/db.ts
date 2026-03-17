import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'data', 'documents.db');

let db: sqlite3.Database | null = null;

function getDB(): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(db!);
      }
    });
  });
}

function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise(async (resolve, reject) => {
    const database = await getDB();
    database.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

function run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise(async (resolve, reject) => {
    const database = await getDB();
    database.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export { getDB, query, run };
