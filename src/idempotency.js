// In-memory store for our idempotency keys.
// Maps Key -> { status: 'IN_FLIGHT' | 'COMPLETED', bodyHash: string, promise?: Promise, response?: object }
const crypto = require("crypto");

const idempotencyStore = new Map();

function hashPayload(body) {
  if (!body || typeof body !== "object" || Object.keys(body).length === 0) {
    return "";
  }
  return crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

module.exports = {
  idempotencyStore,
  hashPayload,
};
