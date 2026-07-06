const express = require("express");
const { idempotencyStore, hashPayload, clearKey } = require("../idempotency");
const { getCompletedRecord, saveCompletedRecord } = require("../db");
const router = express.Router();

function mockPaymentProcessing(amount, currency) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        status: 201,
        data: {
          message: `Charged ${amount} ${currency}`,
          transactionId: `tx_${Date.now()}`,
        },
      });
    }, 2000);
  });
}

// Looks up what we already know about this key: still processing (in the
// Map), already finished (in SQLite), or never seen before (null).
function findExistingKey(key) {
  if (idempotencyStore.has(key)) {
    const inFlight = idempotencyStore.get(key);
    return {
      bodyHash: inFlight.bodyHash,
      inFlight: true,
      promise: inFlight.promise,
    };
  }
  const completed = getCompletedRecord(key);
  if (completed) {
    return {
      bodyHash: completed.bodyHash,
      inFlight: false,
      status: completed.status,
      data: completed.data,
    };
  }
  return null;
}

router.post("/", async (req, res) => {
  const idempotencyKey = req.headers["idempotency-key"];
  const { amount, currency } = req.body || {};

  if (!idempotencyKey) {
    return res.status(400).json({ error: "Missing 'Idempotency-Key' header." });
  }
  if (!amount || !currency) {
    return res
      .status(400)
      .json({ error: "Please provide both a numeric amount and currency." });
  }

  const currentHash = hashPayload(req.body);
  const existing = findExistingKey(idempotencyKey);

  // We've seen this key before, either still processing or already done
  if (existing) {
    // Same key, different payment details -> reject
    if (existing.bodyHash !== currentHash) {
      return res.status(422).json({
        error: "Idempotency key already used for a different request body.",
      });
    }

    // Still processing -> wait for that same result instead of charging again
    if (existing.inFlight) {
      try {
        const result = await existing.promise;
        res.set("X-Cache-Hit", "true");
        return res.status(result.status).json(result.data);
      } catch (err) {
        return res
          .status(500)
          .json({ error: "Original request failed during retry." });
      }
    }

    // Already finished -> return the same saved result
    res.set("X-Cache-Hit", "true");
    return res.status(existing.status).json(existing.data);
  }

  // Brand new key -> actually process the payment
  const paymentPromise = mockPaymentProcessing(amount, currency);
  idempotencyStore.set(idempotencyKey, {
    bodyHash: currentHash,
    promise: paymentPromise,
  });

  try {
    const result = await paymentPromise;
    saveCompletedRecord(
      idempotencyKey,
      currentHash,
      result.status,
      result.data,
    );
    clearKey(idempotencyKey);
    res.set("X-Cache-Hit", "false");
    return res.status(result.status).json(result.data);
  } catch (error) {
    clearKey(idempotencyKey);
    return res.status(500).json({ error: "Payment processing failed." });
  }
});

module.exports = router;
