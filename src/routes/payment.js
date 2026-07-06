const express = require("express");
const { idempotencyStore, hashPayload, clearKey } = require("../idempotency");
const { getCompletedRecord, saveCompletedRecord } = require("../db");
const router = express.Router();

/**
 * Simulates calling an external bank or payment gateway (like Stripe or Paystack).
 * I added an artificial 2-second delay (setTimeout) to mimic real-world network latency.
 * This 2-second window is what makes testing concurrent race conditions possible!
 */
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

  // Step 1: Input Validation
  // Enforce the Pay-Once Protocol: Every request MUST have an Idempotency-Key
  if (!idempotencyKey) {
    return res.status(400).json({ error: "Missing 'Idempotency-Key' header." });
  }
  if (!amount || !currency) {
    return res
      .status(400)
      .json({ error: "Please provide both a numeric amount and currency." });
  }

  // Generate the cryptographic hash of the incoming request body
  const currentHash = hashPayload(req.body);

  // Step 2: TIER 1 CACHE CHECK (In-Memory RAM / Active Requests)
  if (idempotencyStore.has(idempotencyKey)) {
    const existing = idempotencyStore.get(idempotencyKey);

    // --- STORY 3: PAYLOAD MISMATCH (Fraud / Error Check) ---
    // The client is using a known key, but the body hash doesn't match!
    // Example: They originally asked to charge $10, but now changed it to $500.
    if (existing.bodyHash !== currentHash) {
      return res.status(422).json({
        error: "Idempotency key already used for a different request body.",
      });
    }

    // --- STORY 4: CONCURRENT RACE CONDITION (The "Secret Sauce") ---
    // The key exists in RAM and is marked "IN_FLIGHT". This means the user
    // double-clicked the pay button, and the first payment is STILL processing!
    if (existing.status === "IN_FLIGHT") {
      try {
        // Instead of starting a second charge, we attach to the existing Promise!
        // Both requests will pause right here and wait for the same bank response.
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

  // Step 3: TIER 2 CACHE CHECK (SQLite Persistent Storage / Past Requests)
  // We check SQLite unconditionally. If the payment finished seconds, hours,
  // or days ago, it will be stored here.
  const existingRecord = getCompletedRecord(idempotencyKey);
  if (existingRecord) {
    // --- STORY 3: PAYLOAD MISMATCH (Against previously completed records) ---
    if (existingRecord.bodyHash !== currentHash) {
      return res.status(422).json({
        error: "Idempotency key already used for a different request body.",
      });
    }

    // --- STORY 2: DUPLICATE RETRY (Happy Cache Hit) ---
    // The transaction was already completed in the past. We immediately return
    // the saved receipt with an X-Cache-Hit header without charging them again!
    res.set("X-Cache-Hit", "true");
    return res.status(existingRecord.status).json(existingRecord.data);
  }

  // Step 4: TIER 3 - STORY 1: HAPPY PATH (Brand New Payment)
  // If we made it here, this is a completely new transaction!
  // 1. Initiate the async payment processing promise
  const paymentPromise = mockPaymentProcessing(amount, currency);

  // 2. Immediately lock this key in RAM as "IN_FLIGHT" so any race-condition
  // requests that arrive in the next 2 seconds get intercepted by Step 2.
  idempotencyStore.set(idempotencyKey, {
    status: "IN_FLIGHT",
    bodyHash: currentHash,
    promise: paymentPromise,
  });

  try {
    // 3. Wait for the bank/mock processor to finish (takes ~2 seconds)
    const result = await paymentPromise;

    // 4. Save the successful receipt permanently to SQLite
    saveCompletedRecord(
      idempotencyKey,
      currentHash,
      result.status,
      result.data,
    );

    // 5. Clean up RAM! It's safely in SQLite now, so we don't need it in memory.
    clearKey(idempotencyKey);

    // 6. Return the fresh receipt to the client (X-Cache-Hit is false)
    res.set("X-Cache-Hit", "false");
    return res.status(result.status).json(result.data);
  } catch (error) {
    // If the bank processing crashes, clear the RAM lock so the user can try again
    clearKey(idempotencyKey);
    return res.status(500).json({ error: "Payment processing failed." });
  }
});

module.exports = router;
