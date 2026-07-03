const express = require("express");
const { idempotencyStore, hashPayload, clearKey } = require("../idempotency");
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

  // STORY 1: Happy Path (New Request!)
  const paymentPromise = mockPaymentProcessing(amount, currency);

  idempotencyStore.set(idempotencyKey, {
    status: "IN_FLIGHT",
    bodyHash: currentHash,
    promise: paymentPromise,
  });

  try {
    const result = await paymentPromise;

    idempotencyStore.set(idempotencyKey, {
      status: "COMPLETED",
      bodyHash: currentHash,
      response: result,
    });

    res.set("X-Cache-Hit", "false");
    return res.status(result.status).json(result.data);
  } catch (error) {
    clearKey(idempotencyKey);
    return res.status(500).json({ error: "Payment processing failed." });
  }
});

module.exports = router;
