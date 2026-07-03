// In-memory store for our idempotency keys.
// Maps Key -> { status: 'IN_FLIGHT' | 'COMPLETED', bodyHash: string, promise?: Promise, response?: object }
const idempotencyStore = new Map();

module.exports = {
  idempotencyStore,
};
