const crypto = require("crypto");

// IN-MEMORY STORAGE (TIER 1 CACHE)
// Why a Map instead of SQLite here?
const idempotencyStore = new Map();

/**
 * Generates a deterministic SHA-256 hash of the request body.
 * Why is this critical? It enables Story 3 (Fraud/Error Check). We need to verify
 * that if a client retries a transaction key, they didn't change the amount!
 */
function hashPayload(body) {
  // If the body is empty or undefined, return an empty string
  if (!body || typeof body !== "object" || Object.keys(body).length === 0) {
    return "";
  }

  const sorted = Object.keys(body)
    .sort()
    .reduce((acc, key) => {
      acc[key] = body[key];
      return acc;
    }, {});

  // Create a secure SHA-256 hexadecimal fingerprint of the standardized JSON
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(sorted))
    .digest("hex");
}

function clearKey(key) {
  idempotencyStore.delete(key);
}

module.exports = {
  idempotencyStore,
  hashPayload,
  clearKey,
};
