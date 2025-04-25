import axios from "axios";
import fs from "fs";
import path from "path";
import { producer } from "./producer.js";

const usersrPath = path.resolve("usersr.json");
const userssPath = path.resolve("userss.json");

const usersrData = fs.readFileSync(usersrPath, "utf-8");
const usersr = JSON.parse(usersrData);

const userssData = fs.readFileSync(userssPath, "utf-8");
const userss = JSON.parse(userssData);

const endpoints = [
    { method: "get", url: "http://localhost:8000/slow" },
    { method: "get", url: "http://localhost:8000/" },
    { method: "get", url: "http://localhost:8000/status" },
];

const alertTypes = [
    "CPU Overload on Server-1",
    "Memory Leak Detected in Auth Service",
    "Disk Usage Above 90% on Node-3",
    "Database Connection Timeout",
    "Application Crash in Production",
    "High Latency on API Gateway",
    "Security Alert: Unauthorized Access Attempt",
    "Service Unavailable: Cache Server Down",
    "SSL Certificate Expiring Soon",
    "Deployment Failed: CI/CD Pipeline Error",
];

function getRandomValue(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function getRandomUser(users) {
    return users[Math.floor(Math.random() * users.length)];
}

function getRandomSeverity() {
    return getRandomValue(["INFO", "WARNING", "CRITICAL", "ERROR"]);
}

function getRandomAlert() {
    return {
        timestamp: new Date().toISOString(),
        type: "SYSTEM_ALERT",
        message: getRandomValue(alertTypes),
        severity: getRandomSeverity(),
        source: `service-${Math.floor(Math.random() * 10) + 1}`,
    };
}

// 📤 Send alerts every 3 seconds
function sendRandomAlerts(intervalMs = 3000) {
    setInterval(async () => {
        const alert = getRandomAlert();
        try {
            const response = await axios.post("http://localhost:3000/alerts", alert);
            console.log("✅ Alert sent:", response.data);
            await producer.send({
                topic: "alerts",
                messages: [
                    {
                        key: "Alert",
                        value: JSON.stringify(alert),
                    },
                ],
            });
        } catch (error) {
            console.error("❌ Failed to send alert:", error.message);
        }
    }, intervalMs);
}


async function signinUser() {
    const user = getRandomUser(userss);
    console.log("🔍 Logging in with:", user);
    user.userId = parseInt(user.userId);
    try {
        const res = await axios.post("http://localhost:8000/api/signin", user);
        const endpoint = "http://localhost:8000/api/signin";
        const log = {
            timestamp: new Date().toISOString(),
            message: res.data.success
                ? `Sign-in successful for User ID: ${user.userId}`
                : `${endpoint} Unauthorized Attempt to login for User ID: ${user.userId} -> ${user.userName}`,
            
        };

        const topic = res.data.success ? "info" : "alerts";
        await producer.send({
            topic,
            messages: [
                {
                    key: "signin",
                    value: JSON.stringify(log),
                },
            ],
        });
        if(topic=="alerts"){
            await producer.send({
                topic:"error-logs",
                messages: [
                    {
                        key: "signin",
                        value: JSON.stringify(log),
                    },
                ],
            });
        }

        if (!res.data.success) {
            console.log(`⚠️ ${log.message}`);
        } else {
            console.log(`✅ ${log.message}`);
        }
    } catch (err) {
        console.error("❌ Sign-in request failed:", err.message);
    }
}

// 📝 Simulate user registration
async function registerUser() {
    const user = { ...getRandomUser(usersr) };
    user.userId = parseInt(user.userId);
    console.log("User ID:", user.userId);
    console.log("User Name:", user.userName);
    console.log("Password", user.password);
    

    try {
        const res = await axios.post("http://localhost:8000/api/register", {
            userId: user.userId,
            userName: user.userName,
            password: user.password,
            userType: user.userType,
        });
        

        const log = {
            timestamp: new Date().toISOString(),
            message: res.data.message,
            
        };

        console.log("✅ Registration successful:", log.message);
        await producer.send({
            topic: "info",
            messages: [
                {
                    key: "registration",
                    value: JSON.stringify(log),
                },
            ],
        });
    } catch (err) {
        const endpoint = "http://localhost:8000/api/register";
        const errorLog = {
            timestamp: new Date().toISOString(),
            message: `${endpoint} Registration failed for User ID: ${user.userId}  - ${err.message}`,
            status: "ERROR",
        };
        console.error("❌ Registration failed");
        await producer.send({
            topic: "error-logs",
            messages: [
                {
                    key: "registration",
                    value: JSON.stringify(errorLog),
                },
            ],
        });
    }
}

// 🌐 Send random endpoint requests and log responses
async function sendRandomRequest() {
    const endpoint = getRandomValue(endpoints);
    try {
        const response = await axios({ method: endpoint.method, url: endpoint.url });
        console.log(`✅ ${endpoint.method.toUpperCase()} ${endpoint.url} → Status: ${response.status}`);

        const log = {
            timestamp: new Date().toISOString(),
            message: `${endpoint.url} responded with status ${response.status}`,
            status: response.status === 200 ? "INFO" : "ERROR",
        };

        const topic = response.status === 200 ? "info" : "error-logs";

        await producer.send({
            topic,
            messages: [
                {
                    key: `endpoint-${endpoint.url}`,
                    value: JSON.stringify(log),
                },
            ],
        });
    } catch (error) {
        console.log(`❌ ${endpoint.method.toUpperCase()} ${endpoint.url} → Error: ${error.message}`);

        const errorLog = {
            timestamp: new Date().toISOString(),
            message: ` ${endpoint.url}: ${error.message}`,
            status: "ERROR",
        };

        await producer.send({
            topic: "error-logs",
            messages: [
                {
                    key: `endpoint-${endpoint.url}`,
                    value: JSON.stringify(errorLog),
                },
            ],
        });

    }
}

// 🔁 Load testing simulation
function startLoadTesting() {
    setInterval(() => {
        sendRandomRequest();
    }, Math.floor(Math.random() * (2000 - 500) + 9000));
}

// 🧪 Randomly trigger user registration and login
function simulateUserActivity() {
    setInterval(() => {
        const action = Math.random() < 0.5 ? registerUser : signinUser;
        action();
    }, 10000);
}

// 🏁 Main
(async () => {
    console.log("🚀 Starting load testing and alert simulation...");
    startLoadTesting();       // API requests
    sendRandomAlerts();       // Alert simulation
    simulateUserActivity();   // User actions
})();

