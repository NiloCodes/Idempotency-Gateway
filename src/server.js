const express = require("express");
const paymentRouter = require("./routes/payment");
const { idempotencyStore } = require("./idempotency");

const app = express();

// Middleware to automatically parse incoming JSON request bodies
app.use(express.json());

// ROUTE MOUNTING
// All traffic directed to /process-payment is handed off to payment.js
app.use("/process-payment", paymentRouter);

// A simple health check endpoint to confirm the API is online and responsive
app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = 3000;

// Start the server listening on port 3000
app.listen(PORT, () => {
  console.log(
    `FinSafe Idempotency Gateway listening on http://localhost:${PORT}`,
  );
});
