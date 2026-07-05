const path = require("path");
const Database = require("better-sqlite3");

const db = new Database(path.join(__dirname, "..", "idempotency.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS completed_payments (
    key TEXT PRIMARY KEY,
    body_hash TEXT NOT NULL,
    status INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

function getCompletedRecord(key) {
  const row = db
    .prepare("SELECT * FROM completed_payments WHERE key = ?")
    .get(key);
  if (!row) return null;
  return {
    bodyHash: row.body_hash,
    status: row.status,
    data: JSON.parse(row.data),
  };
}

function saveCompletedRecord(key, bodyHash, status, data) {
  db.prepare(
    `INSERT INTO completed_payments (key, body_hash, status, data, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(key, bodyHash, status, JSON.stringify(data), Date.now());
}

module.exports = { getCompletedRecord, saveCompletedRecord };
