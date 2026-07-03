const express = require("express");
const paymentRouter = require("./routes/payment");
const { idempotencyStore } = require("./idempotency");

const app = express();
app.use(express.json());

// Mount payment router
app.use("/process-payment", paymentRouter);

app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(
    `FinSafe Idempotency Gateway listening on http://localhost:${PORT}`,
  );
});
