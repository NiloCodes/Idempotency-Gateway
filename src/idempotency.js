// In-memory store for our idempotency keys.
// Maps Key -> { status: 'IN_FLIGHT' | 'COMPLETED', bodyHash: string, promise?: Promise, response?: object }
const crypto = require("crypto");

const idempotencyStore = new Map();
function hashPayload(body) {
  if (!body || typeof body !== "object" || Object.keys(body).length === 0) {
    return "";
  }

  // Sort keys alphabetically so {"amount": 100, "currency": "GHS"} matches {"currency": "GHS", "amount": 100}
  const sorted = Object.keys(body)
    .sort()
    .reduce((acc, key) => {
      acc[key] = body[key];
      return acc;
    }, {});

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(sorted))
    .digest("hex");
}

module.exports = {
  idempotencyStore,
  hashPayload,
};
