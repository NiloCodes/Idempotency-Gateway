// A simple script to fire two simultaneous requests to our gateway
const URL = "http://localhost:3000/process-payment";
const SHARED_KEY = "race-key-" + Date.now(); // Generates a unique key for this test

const payload = {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Idempotency-Key": SHARED_KEY,
  },
  body: JSON.stringify({ amount: 500, currency: "GHS" }),
};

console.log(
  ` Firing Request A and Request B simultaneously with key: ${SHARED_KEY}...\n`,
);

// Promise.all fires both fetch requests at the exact same time without waiting!
Promise.all([
  fetch(URL, payload).then(async (res) => ({
    name: "Request A",
    status: res.status,
    cacheHit: res.headers.get("X-Cache-Hit"),
    data: await res.json(),
  })),
  fetch(URL, payload).then(async (res) => ({
    name: "Request B",
    status: res.status,
    cacheHit: res.headers.get("X-Cache-Hit"),
    data: await res.json(),
  })),
]).then((results) => {
  console.log("Both requests finished! Here are the results:\n");
  console.log(results);
});
