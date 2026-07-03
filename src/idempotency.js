const crypto = require("crypto");
const idempotencyStore = new Map();

function hashPayload(body) {
  if (!body || typeof body !== "object" || Object.keys(body).length === 0) {
    return "";
  }
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

function clearKey(key) {
  idempotencyStore.delete(key);
}

module.exports = {
  idempotencyStore,
  hashPayload,
  clearKey,
};
