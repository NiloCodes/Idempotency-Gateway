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

  // 2. Check if we have seen this key before
  if (idempotencyStore.has(idempotencyKey)) {
    const existing = idempotencyStore.get(idempotencyKey);

    // STORY 3: Fraud/Error Check (Same key, different payload!)
    if (existing.bodyHash !== currentHash) {
      return res.status(422).json({
        error: "Idempotency key already used for a different request body.",
      });
    }

    // STORY 2: Duplicate Attempt (Payment already finished previously)
    const existingRecord = getCompletedRecord(idempotencyKey);
    if (existingRecord) {
      if (existingRecord.bodyHash !== currentHash) {
        return res.status(422).json({
          error: "Idempotency key already used for a different request body.",
        });
      }
      res.set("X-Cache-Hit", "true");
      return res.status(existingRecord.status).json(existingRecord.data);
    }

    // BONUS STORY: Concurrent Race Condition (Payment is still IN_FLIGHT!)
    if (existing.status === "IN_FLIGHT") {
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
  }
  // STORY 1: Happy Path (New Request!)
  const paymentPromise = mockPaymentProcessing(amount, currency);

  idempotencyStore.set(idempotencyKey, {
    status: "IN_FLIGHT",
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
    clearKey(idempotencyKey); // done being in-flight now that it's persisted

    res.set("X-Cache-Hit", "false");
    return res.status(result.status).json(result.data);
  } catch (error) {
    clearKey(idempotencyKey);
    return res.status(500).json({ error: "Payment processing failed." });
  }
});

module.exports = router;
