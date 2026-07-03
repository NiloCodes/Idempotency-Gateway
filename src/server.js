const express = require("express");
const app = express();

const PORT = 3000;
app.listen(PORT, () => {
  console.log(
    `FinSafe Idempotency Gateway listening on http://localhost:${PORT}`,
  );
});
