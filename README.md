# AP‑Monitor

A small Node.js monitoring playground that shows how to:

- Expose application metrics with Prometheus (`prom-client`)
- Produce and consume logs/events with Kafka (`kafkajs`)
- Ship logs to Loki using `winston` + `winston-loki`, and visualize them in Grafana
- Simulate traffic, failures, and auth flows to populate dashboards


## What’s inside

- `server.js` — Express API with metrics at `/metrics`, demo routes (`/`, `/slow`, `/status`), an alert webhook `/alerts`, and simple MySQL‑backed auth (`/api/register`, `/api/signin`).
- `producer.js` — Kafka producer instance used by server and traffic generator.
- `consumer.js` — Kafka consumer that forwards logs to Loki via `winston-loki`.
- `client.js` — Kafka client/broker configuration.
- `admin.js` — One‑off script to create Kafka topics (`error-logs`, `info`, `alerts`).
- `requests.js` — Traffic + alerts simulator (sends HTTP calls to the API and produces Kafka messages).
- `delay_error.js` — Helpers to add latency and random failures.
- `prom-config.yml` — Prometheus scrape config (targets the API’s `/metrics`).
- `dashboard.json` — Ready‑to‑import Grafana dashboard for metrics and logs.
- `docker-compose.yml` — Runs Prometheus with the provided config.


## Requirements

- Node.js 18+ (ESM is enabled via `"type": "module"`)
- Docker (for Prometheus/Grafana/Loki/Kafka quick start)
- Kafka + Zookeeper (via Docker as below)
- MySQL (a database called `steamgame` and a `login` table)

Example table used by the auth endpoints:

```sql
CREATE TABLE login (
	UserId INT PRIMARY KEY,
	UserName VARCHAR(100) NOT NULL,
	Password VARCHAR(255) NOT NULL,
	UserType VARCHAR(50) NOT NULL
);
```


## Configuration

Update these values to match your environment:

- MySQL in `server.js`:
	- host, user, password, database. The repo currently has hardcoded values — replace them with yours before running.
- Kafka broker in `client.js`:
	- `brokers: ['192.168.56.1:9092']` — change to your host/broker IP:port (for Docker Desktop on Windows, `localhost:9092` often works if ports are published).
- Prometheus target in `prom-config.yml`:
	- `targets: ["192.168.56.1:8000"]` — if Prometheus runs in Docker, prefer `host.docker.internal:8000` on Windows, or your host IP.
- Alerts target in `requests.js`:
	- Simulator posts to `http://localhost:3000/alerts` by default. If you want to send alerts to this API instead, change it to `http://localhost:8000/alerts`.


## Install

From the project folder `APP_MS`:

```powershell
cd APP_MS
npm install
```


## Run the stack

You can run infra components with Docker, then start the Node processes locally.

1) Start Kafka and Zookeeper (Docker)

```powershell
# Zookeeper
docker run -d --name zookeeper -p 2181:2181 zookeeper

# Kafka (adjust the listener IP to your host if needed)
docker run -d --name kafka -p 9092:9092 `
	-e KAFKA_ZOOKEEPER_CONNECT=host.docker.internal:2181 `
	-e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://host.docker.internal:9092 `
	-e KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 `
	confluentinc/cp-kafka
```

2) Start Loki and Grafana (Docker)

```powershell
docker run -d --name loki -p 3100:3100 grafana/loki
docker run -d --name grafana -p 3000:3000 grafana/grafana-oss
```

3) Start Prometheus (Docker Compose)

```powershell
docker compose up -d prom-server
```

4) Create Kafka topics

```powershell
node admin.js
```

5) Start the Node services (separate terminals)

```powershell
# 1) Start the API server (Express + metrics + MySQL + producer)
node server.js

# 2) Start the Kafka consumer (ships logs to Loki)
node consumer.js

# 3) Start the traffic/alerts simulator (optional)
node requests.js
```


## Using Grafana

1) Open Grafana at http://localhost:3000 (default login `admin` / `admin`).
2) Add data sources:
	 - Prometheus: URL `http://localhost:9090`
	 - Loki: URL `http://localhost:3100`
3) Import `dashboard.json` (Dashboards → Import → Upload JSON).

The dashboard includes:
- Request counts by route, total requests, average duration
- Node.js process CPU/memory, event loop lag, heap details
- Loki panels for `info`, `warn`, and `error` logs
- Error counts by endpoint (Loki query)


## API reference (quick)

- GET `/` → health/welcome.
- GET `/slow` → random delay or error to simulate slowness.
- GET `/status` → random OK/error with common platform error codes.
- GET `/metrics` → Prometheus metrics exposition.
- POST `/alerts` → receives alert JSON payloads.

Auth endpoints (require MySQL):
- POST `/api/register` — body: `{ userId, userName, password, userType }`
- POST `/api/signin` — body: `{ userId, password, userType }`


## Observability wiring

- Metrics: `prom-client` registers default Node.js metrics and custom HTTP metrics (`http_request_duration_seconds`, `http_total_requests`, `http_requests_by_route`). Prometheus scrapes the API at `/metrics`.
- Logging: The API and simulator produce logs/events to Kafka topics (`info`, `alerts`, `error-logs`). The consumer reads these topics and forwards structured logs to Loki via `winston-loki` with labels `{ job: "kafka-consumer", app: "api-server" }`.


## Tips and troubleshooting

- Broker address: If Kafka can’t be reached, ensure `client.js` brokers match how you started Kafka (IP/port). For Docker Desktop on Windows, `host.docker.internal:9092` is often the easiest.
- Prometheus target: When Prometheus runs in Docker, use `host.docker.internal:8000` (Windows) or your host IP instead of `localhost` inside `prom-config.yml`.
- MySQL: Ensure DB `steamgame` and table `login` exist and credentials in `server.js` are valid.
- Ports used: API 8000, Grafana 3000, Loki 3100, Prometheus 9090, Kafka 9092, Zookeeper 2181.
- Alerts simulator: `requests.js` posts to `http://localhost:3000/alerts` by default (Grafana port). If you intend to hit this API’s `/alerts`, change it to `http://localhost:8000/alerts`.


## Notes on security

Avoid committing credentials. Replace hardcoded values in `server.js` with environment variables in your environment. If you introduce `.env`, also add a loader like `dotenv` and keep `.env` out of version control.


## License

No license has been specified in this repository.
