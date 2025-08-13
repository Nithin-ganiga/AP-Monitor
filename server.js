import express from "express";
import client from "prom-client";
import responseTime from "response-time";
import { addDelayError, simulatePlatformError } from "./delay_error.js";
import { producer } from "./producer.js";
import mysql from "mysql2";

const app = express();
const PORT = process.env.PORT || 8000;

// ================== DB Connection ==================
const db = mysql.createConnection({
  host: "127.0.0.1",
  user: "root",
  password: "Nithin#2004",
  database: "steamgame",
});

const sendKafkaError = async (errorMsg) => {
  try {
    await producer.send({
      topic: "error-logs",
      messages: [
        {
          key: "error-update",
          value: JSON.stringify({
            msg: errorMsg,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });

    await producer.send({
      topic: "freq-errors",
      messages: [
        {
          key: "error-update",
          value: JSON.stringify({
            msg: errorMsg,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });
    console.log("📤 Error sent to Kafka topic: error-logs");
  } catch (kafkaErr) {
    console.error("❌ Kafka Error Logging Failed:", kafkaErr.message);
  }
};

db.connect(async (err) => {
  if (err) {
    const errorMessage = `DB connection failed: ${err.message}`;
    console.error("❌", errorMessage);
    await sendKafkaError(errorMessage);
  } else {
    console.log("✅ Connected to MySQL Database");
  }
});

// ================== Middleware ==================
app.use(express.json());

// ================== Prometheus ==================
client.collectDefaultMetrics({ register: client.register });

const reqResTime = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Histogram for request durations in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.1, 0.5, 1, 2, 5],
});

const totalRequests = new client.Counter({
  name: "http_total_requests",
  help: "Total number of HTTP requests",
});

const routeRequestCounter = new client.Counter({
  name: "http_requests_by_route",
  help: "Count of requests per route",
  labelNames: ["method", "route"],
});

app.use(
  responseTime((req, res, time) => {
    totalRequests.inc();
    const route = req.route?.path || req.url;
    routeRequestCounter.labels(req.method, route).inc();

    reqResTime
      .labels(req.method, route, res.statusCode)
      .observe(time / 1000);

    console.log(
      `⏱️ ${req.method} ${route} - ${res.statusCode} - ${time.toFixed(2)} ms`
    );
  })
);

// ================== Routes ==================
app.get("/", (req, res) => {
  res.json({ message: "Welcome to the API!" });
});

app.get("/slow", async (req, res) => {
  try {
    const timeTaken = await addDelayError();
    res.json({
      status: "Success",
      message: `Heavy task completed in ${timeTaken}ms`,
    });
  } catch (error) {
    console.error("⚠️ /slow error:", error);
    res.status(500).json({ status: "Error", error: "Internal Server Error" });
  }
});

app.get("/status", async (req, res) => {
  try {
    const result = await simulatePlatformError();
    res.status(200).json({ status: "OK", message: result });
  } catch (error) {
    console.error("⚠️ Simulated error:", error.message);

    let statusCode = 500;
    const codeMap = {
      "403": 403,
      "401": 401,
      "503": 503,
      "504": 504,
    };

    for (let code in codeMap) {
      if (error.message.includes(code)) {
        statusCode = codeMap[code];
        break;
      }
    }

    res.status(statusCode).json({ status: "ERROR", error: error.message });
  }
});

app.get("/metrics", async (req, res) => {
  res.setHeader("Content-Type", client.register.contentType);
  res.send(await client.register.metrics());
});

app.post("/alerts", (req, res) => {
  console.log("🚨 Alert Received:", req.body);
  res.json({ status: "success", message: "Alert received", data: req.body });
});

// ================== Auth ==================
app.post("/api/signin", (req, res) => {
  const { userId, password, userType } = req.body;
  db.query(
    "SELECT * FROM login WHERE UserId = ? AND Password = ? AND UserType = ?",
    [userId, password, userType],
    (err, results) => {
      if (err) {
        console.error("❌ Sign-in error:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
      if (results.length > 0) {
        res.json({ success: true });
      } else {
        res.json({ success: false, error: "Invalid credentials" });
        console.log("invalid credentials for UserId:", userId);
      }
    }
  );
});

// ============== Registration Route ==============
app.post("/api/register", (req, res) => {
  const { userId, userName, password, userType } = req.body;

  db.beginTransaction((err) => {
    if (err) {
      console.error("❌ Transaction error:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }

    const query =
      "INSERT INTO login (UserId, UserName, Password, UserType) VALUES (?, ?, ?, ?)";

    db.query(query, [userId, userName, password, userType], (err) => {
      if (err) {
        db.rollback(() => {
          const errorMsg =
            err.code === "ER_DUP_ENTRY"
              ? "User ID or Username already exists"
              : "Registration failed";
          console.error("❌ Registration error:", err);
          res.status(400).json({ error: errorMsg });
        });
        return;
      }

      db.commit((err) => {
        if (err) {
          db.rollback(() => {
            console.error("❌ Commit error:", err);
            res.status(500).json({ error: "Registration failed" });
          });
          return;
        }
        console.log(`Registration successful! for : ${userId}:${userName}`);
        res.json({
          success: true,
          message: `Registration successful! for : ${userId}:${userName}`,
        });
      });
    });
  });
});

// ================== Start Server ==================
app.listen(PORT, () =>
  console.log(`🚀 Server is up and running on port ${PORT}`)
);
 