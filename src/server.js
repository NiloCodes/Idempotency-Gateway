const express = require("express");
const app = express();

app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(
    `FinSafe Idempotency Gateway listening on http://localhost:${PORT}`,
  );
});
