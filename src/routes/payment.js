const express = require("express");
const router = express.Router();

/**
 * Simulates calling an external payment processing network (takes 2 seconds)
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

module.exports = router;
