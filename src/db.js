const path = require("path");
const Database = require("better-sqlite3");

// Connect to (or create) the local SQLite database file
const db = new Database(path.join(__dirname, "..", "idempotency.db"));

// DATABASE SCHEMA
db.exec(`
  CREATE TABLE IF NOT EXISTS completed_payments (
    key TEXT PRIMARY KEY,
    body_hash TEXT NOT NULL,
    status INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

/**
 * Look up a completed transaction by its Idempotency-Key.
 * Used for Story 2 (Duplicate Attempt / Network Retry).
 */
function getCompletedRecord(key) {
  const row = db
    .prepare("SELECT * FROM completed_payments WHERE key = ?")
    .get(key);

  if (!row) return null;

  // Parse the stringified JSON data back into a real JavaScript object
  return {
    bodyHash: row.body_hash,
    status: row.status,
    data: JSON.parse(row.data),
  };
}

/**
 * Permanently save a successful payment result.
 * Called at the end of Story 1 (Happy Path).
 */
function saveCompletedRecord(key, bodyHash, status, data) {
  db.prepare(
    `INSERT INTO completed_payments (key, body_hash, status, data, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(key, bodyHash, status, JSON.stringify(data), Date.now());
}

module.exports = { getCompletedRecord, saveCompletedRecord };
