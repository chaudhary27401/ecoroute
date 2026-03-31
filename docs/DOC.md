# EcoRoute — Intelligent Delivery Optimizer

> **Last-mile delivery optimization powered by K-Means clustering, Google OR-Tools VRP, and real-road ETA estimation — served through a React + Leaflet live map interface.**

[![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-blue?logo=react)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?logo=postgresql)](https://postgresql.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Repository Structure](#3-repository-structure)
4. [Tech Stack](#4-tech-stack)
5. [Prerequisites](#5-prerequisites)
6. [Setup & Installation](#6-setup--installation)
7. [Environment Configuration](#7-environment-configuration)
8. [API Documentation](#8-api-documentation)
9. [AI / ML Components](#9-ai--ml-components)
10. [Database Schema](#10-database-schema)
11. [Frontend Guide](#11-frontend-guide)
12. [Key Design Decisions](#12-key-design-decisions)
13. [Known Limitations & Future Work](#13-known-limitations--future-work)
14. [Team Roles](#14-team-roles)
15. [Contributing](#15-contributing)

---

## 1. Project Overview

EcoRoute is a **microservices-based delivery routing platform** built to solve the classic last-mile logistics problem: given a set of delivery orders scattered across a city and a fleet of drivers, how do you assign and sequence deliveries to minimize total travel time?

### What it does

- **Admin** creates orders and drivers, then triggers one-click route optimization.
- The system automatically **clusters** geographically close orders and assigns them to the nearest available driver.
- Each driver's stops are **sequenced optimally** using a Vehicle Routing Problem (VRP) solver with real road-network travel times.
- **ETA** (estimated time of arrival) is computed per stop using the OpenRouteService Directions API.
- Drivers see their assigned route on a live map and mark stops as delivered one by one. The map updates in real time after each delivery.

### Who it's for

- Small-to-medium logistics operations, courier services, hyperlocal delivery startups, and food delivery platforms.

---

## 2. System Architecture

EcoRoute is composed of **four independent services** that communicate over HTTP.

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│               React + Leaflet (port 5173)                   │
│   /api/orders/* ──────────────┐   /api/drivers/* ───────┐   │
└───────────────────────────────┼────────────────────────-─┼───┘
                                │ (Vite reverse proxy)      │
                    ┌───────────▼──────────┐   ┌───────────▼──────────┐
                    │   Order Service      │   │   Driver Service     │
                    │   FastAPI :5001      │◄──│   FastAPI :5002      │
                    │                      │   │                      │
                    │  - CRUD orders       │   │  - CRUD drivers      │
                    │  - Orchestrates ML   │   │  - Status tracking   │
                    │  - Writes results    │   │  - Location updates  │
                    └──────────┬───────────┘   └──────────────────────┘
                               │ POST /optimize
                    ┌──────────▼───────────┐
                    │   ML Optimizer       │
                    │   FastAPI :8000      │
                    │                      │
                    │  - K-Means cluster   │
                    │  - OR-Tools VRP      │
                    │  - ORS ETA calc      │
                    └──────────────────────┘
                               │ (all services)
                    ┌──────────▼───────────┐
                    │   PostgreSQL :5432   │
                    │   (shared database)  │
                    └──────────────────────┘
```

### Optimization Flow (Step-by-Step)

```
Admin clicks "Optimize Routes"
        │
        ▼
[1] Order Service fetches all UNASSIGNED orders from DB
        │
        ▼
[2] Order Service calls Driver Service → GET /drivers/available
        │
        ▼
[3] Order Service POSTs to ML Optimizer → POST /optimize
        │        { orders: [...], num_drivers: N }
        ▼
[4] ML: K-Means clusters orders by geography
        │
        ▼
[5] ML: OR-Tools VRP sequences each cluster optimally
        │         (using ORS real-road distance matrix)
        ▼
[6] ML: ORS Directions API calculates cumulative ETA per stop
        │
        ▼
[7] ML returns { cluster_id: { route, eta } } to Order Service
        │
        ▼
[8] Order Service maps cluster → real driver_id, writes to DB
        │         (driver_id, cluster_id, sequence_order, eta, status=ASSIGNED)
        ▼
[9] Order Service fetches OSRM road geometry for each driver route
        │
        ▼
[10] Returns { message, geometries } to Frontend
        │
        ▼
[11] Frontend renders color-coded polylines on map, refreshes cards
```

### Delivery Flow (Driver Side)

```
Driver selects their profile → sees map + ordered stop list
        │
        ▼
Driver taps "Mark Delivered" on current stop
        │
        ▼
Order Service: marks order DELIVERED, calls Driver Service to update GPS pin
        │
        ▼
Remaining stops? → rebuild OSRM geometry → return new_geometry to frontend
No remaining stops? → mark driver AVAILABLE → show completion banner
```

---

## 3. Repository Structure

```
ecoroute/
│
├── database/
│   ├── core_schema.sql        # ENUMs, drivers table, orders table
│   ├── relations.sql          # assignments table + spatial indexes
│   └── seed_data.sql          # sample drivers and orders for local dev
│
├── docs/
│   └── architecture.md        # Component overview and flow reference
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js         # Reverse proxy config for /api
│   └── src/
│       ├── App.jsx            # Router: /, /admin, /driver
│       ├── main.jsx
│       ├── index.css          # Global styles + component classes
│       ├── api/
│       │   └── client.js      # Axios instances for orders + drivers
│       ├── components/
│       │   └── Map/
│       │       └── MapView.jsx  # Leaflet map, markers, polylines, OSRM
│       └── pages/
│           ├── RoleSelector.jsx   # Landing: Admin or Driver
│           ├── AdminDashboard.jsx # Order/driver management + optimize
│           └── DriverView.jsx     # Driver login, route, mark delivered
│
├── optimizations/
│   ├── clustering.py          # K-Means + cluster balancing
│   ├── routing.py             # OR-Tools VRP + ORS distance matrix
│   ├── eta.py                 # Cumulative ETA via ORS Directions API
│   ├── optimizer_api.py       # FastAPI wrapper exposing /optimize
│   ├── test_pipeline.py       # End-to-end pipeline smoke test
│   ├── requirements.txt
│   └── readme.MD              # ML module integration guide
│
└── services/
    ├── driver-service/
    │   ├── main.py            # FastAPI app entry point
    │   ├── models.py          # SQLAlchemy Driver model
    │   ├── schemas.py         # Pydantic request schemas
    │   ├── database.py        # SQLAlchemy engine + session
    │   ├── requirements.txt
    │   └── routers/
    │       └── driver.py      # All /drivers/* endpoints
    │
    └── order-service/
        ├── main.py            # FastAPI app entry point
        ├── models.py          # SQLAlchemy Order model
        ├── schemas.py         # Pydantic request schemas
        ├── database.py        # SQLAlchemy engine + session
        ├── requirements.txt
        └── routers/
            └── order.py       # All /orders/* endpoints + optimize orchestration
```

---

## 4. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18, Vite, React-Leaflet, Axios | UI, map rendering, API calls |
| Order Service | FastAPI, SQLAlchemy, Pydantic | Order CRUD, ML orchestration |
| Driver Service | FastAPI, SQLAlchemy, Pydantic | Driver CRUD, status/location management |
| ML Optimizer | FastAPI, scikit-learn, OR-Tools, openrouteservice | Clustering, VRP, ETA |
| Database | PostgreSQL 16 | Persistent storage |
| Map Tiles | OpenStreetMap (via Leaflet) | Free map rendering |
| Road Routing | OSRM (public API) | Real-road route polylines for map |
| Road Distance | OpenRouteService API | Distance matrix + travel time for ML |

---

## 5. Prerequisites

Make sure the following are installed before setup:

- **Python 3.10+** — for all three backend services
- **Node.js 18+ and npm** — for the React frontend
- **PostgreSQL 16** — either locally installed or via Docker
- **Docker** (optional but recommended) — easiest way to run PostgreSQL
- **OpenRouteService API Key** — free tier available at [openrouteservice.org](https://openrouteservice.org/)

---

## 6. Setup & Installation

Clone the repository and follow the steps below. All four services must be running simultaneously.

### Step 1 — Start PostgreSQL

**Using Docker (recommended):**

```powershell
docker run -d `
  --name ecoroute-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=ecoroute `
  -p 5432:5432 `
  postgres:16
```

**Using a local PostgreSQL install:**

Create a database named `ecoroute` with user `postgres` and password `postgres`, or update the `DATABASE_URL` in `database.py` for both services.

**Initialize the schema:**

```sql
-- Run in psql or your DB client:
\i database/core_schema.sql
\i database/relations.sql
\i database/seed_data.sql   -- optional: loads sample data
```

---

### Step 2 — Start Driver Service (port 5002)

```powershell
cd services/driver-service

# Create and activate virtual environment
python -m venv env
env\Scripts\activate          # Windows
# source env/bin/activate     # Mac/Linux

pip install -r requirements.txt

uvicorn main:app --host 0.0.0.0 --port 5002 --reload
```

Verify: [http://localhost:5002/](http://localhost:5002/) → `{"message": "Driver Service Running 🚀"}`

---

### Step 3 — Start Order Service (port 5001)

```powershell
cd services/order-service

python -m venv env
env\Scripts\activate

pip install -r requirements.txt

uvicorn main:app --host 0.0.0.0 --port 5001 --reload
```

Verify: [http://localhost:5001/](http://localhost:5001/) → `{"message": "Order Service Running 🚀"}`

---

### Step 4 — Start ML Optimizer Service (port 8000)

> **Important:** Add your OpenRouteService API key to `optimizations/routing.py` and `optimizations/eta.py` before starting.

```powershell
cd optimizations

python -m venv env
env\Scripts\activate

pip install -r requirements.txt

uvicorn optimizer_api:app --host 0.0.0.0 --port 8000 --reload
```

Verify: [http://localhost:8000/health](http://localhost:8000/health) → `{"status": "ok", "service": "optimizer"}`

**Smoke test the full pipeline (no API key needed for clustering):**

```powershell
python test_pipeline.py
```

---

### Step 5 — Start Frontend (port 5173)

```powershell
cd frontend

npm install

npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

### All Services Checklist

| Service | Port | Health Check URL |
|---|---|---|
| Driver Service | 5002 | http://localhost:5002/ |
| Order Service | 5001 | http://localhost:5001/ |
| ML Optimizer | 8000 | http://localhost:8000/health |
| Frontend | 5173 | http://localhost:5173 |
| PostgreSQL | 5432 | (connect with psql or pgAdmin) |

---

## 7. Environment Configuration

Currently, service URLs and database credentials are hardcoded. For production, replace them with environment variables.

| Variable | Default | Used In |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/ecoroute` | `services/*/database.py` |
| `ORS_API_KEY` | *(hardcoded in file)* | `optimizations/routing.py`, `optimizations/eta.py` |
| `DRIVER_SVC_URL` | `http://localhost:5002` | `services/order-service/routers/order.py` |
| `ML_OPTIMIZER_URL` | `http://localhost:8000` | `services/order-service/routers/order.py` |

To override the ML optimizer URL (e.g., if running on a different host), edit the constant at the top of `services/order-service/routers/order.py`.

---

## 8. API Documentation

Interactive Swagger docs are auto-generated by FastAPI. Once services are running, visit:

- Order Service: [http://localhost:5001/docs](http://localhost:5001/docs)
- Driver Service: [http://localhost:5002/docs](http://localhost:5002/docs)
- ML Optimizer: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Driver Service — `http://localhost:5002`

#### `POST /drivers/`
Create a new driver.

**Request body:**
```json
{
  "name": "Jane Smith",
  "phone": "+919876543210",
  "address": "22 MG Road, Kanpur",
  "latitude": 26.4499,
  "longitude": 80.3319
}
```

**Response:** `201 Created` — full driver object with generated `id` and `status: "AVAILABLE"`.

---

#### `GET /drivers/`
List all drivers (any status).

**Response:** Array of driver objects.

---

#### `GET /drivers/available`
List only drivers with `status = "AVAILABLE"`. Called internally by the Order Service during optimization.

---

#### `GET /drivers/login?phone=<phone>`
Fetch a driver by phone number. Used by the Driver login screen.

**Query param:** `phone` — URL-encoded phone string.

**Response:** Driver object, or `{"error": "Driver not found"}`.

---

#### `PATCH /drivers/{driver_id}/assign`
Mark a driver as `ASSIGNED`. Called internally by Order Service after optimization.

---

#### `PATCH /drivers/{driver_id}/free`
Mark a driver as `AVAILABLE`. Called internally when all their deliveries are complete.

---

#### `PATCH /drivers/{driver_id}/location`
Update a driver's GPS coordinates. Called after each delivery to move the map pin.

**Request body:**
```json
{ "latitude": 26.4521, "longitude": 80.3345 }
```

---

### Order Service — `http://localhost:5001`

#### `POST /orders/`
Create a new delivery order.

**Request body:**
```json
{
  "order_name": "Package A",
  "order_size": "medium",
  "address": "Naveen Market, Kanpur",
  "latitude": 26.4532,
  "longitude": 80.3412
}
```

**Response:** Full order object with `status: "UNASSIGNED"`.

---

#### `GET /orders/`
List all orders regardless of status.

---

#### `GET /orders/unassigned`
List only orders with `status = "UNASSIGNED"`.

---

#### `GET /orders/driver/{driver_id}`
Get all orders assigned to a specific driver, sorted by `sequence_order`.

**Response:** Array of order objects, each including `sequence_order` and `eta`.

---

#### `POST /orders/optimize`
Trigger the full optimization pipeline. This is the core orchestration endpoint.

**Flow:** Fetches unassigned orders → queries available drivers → calls ML optimizer → writes assignments back to DB → returns route geometries.

**Response:**
```json
{
  "message": "Optimization complete",
  "geometries": {
    "1": [[26.45, 80.33], [26.46, 80.34], ...],
    "2": [[26.47, 80.35], ...]
  }
}
```

**Possible messages:**
- `"Optimization complete"` — success
- `"No orders to optimize"` — all orders already assigned
- `"No drivers available"` — all drivers are currently ASSIGNED

**Error responses:**
- `503` — Driver service or ML optimizer is not reachable
- `502` — Driver service or ML service returned an error

---

#### `PATCH /orders/{order_id}/deliver`
Mark an order as delivered. Triggers driver location update, route rebuild, and driver status change if all stops are done.

**Response:**
```json
{
  "message": "Order delivered",
  "driver_freed": false,
  "driver_id": 1,
  "new_geometry": [[26.45, 80.33], [26.46, 80.34], ...]
}
```

- `driver_freed: true` — driver is now AVAILABLE, all their stops are done
- `new_geometry` — updated OSRM road polyline from driver's new position to remaining stops

---

### ML Optimizer — `http://localhost:8000`

#### `GET /health`
Returns service status.

```json
{ "status": "ok", "service": "optimizer", "version": "1.1" }
```

---

#### `POST /optimize`
Run the full optimization pipeline for a set of orders and drivers.

**Request body:**
```json
{
  "orders": [
    { "id": 1, "location": [26.4499, 80.3319] },
    { "id": 2, "location": [26.4521, 80.3345] }
  ],
  "num_drivers": 2
}
```

**Response:**
```json
{
  "0": {
    "orders": [...],
    "route": [
      { "stop": 1, "order_id": 1, "location": [26.4499, 80.3319] },
      { "stop": 2, "order_id": 4, "location": [26.4532, 80.3412] }
    ],
    "eta": [
      { "order_id": 1, "minutes_left": 3.2 },
      { "order_id": 4, "minutes_left": 8.7 }
    ]
  },
  "1": { ... }
}
```

---

## 9. AI / ML Components

All ML logic lives in `optimizations/`. The three modules form a sequential pipeline.

---

### Module 1 — Geographic Clustering (`clustering.py`)

**Goal:** Assign orders to drivers such that each driver handles geographically close deliveries.

**Algorithm:** K-Means++ clustering on `[latitude, longitude]` coordinates.

```
Input:  N orders with coordinates, K drivers
Output: { driver_index: [list of orders] }
```

**Implementation details:**

- Uses `sklearn.cluster.KMeans` with `init="k-means++"`, `n_init=20` (20 random restarts for stability).
- After clustering, a **balancing step** (`balance_clusters()`) ensures no driver gets significantly more orders than others. The ceiling is `ceil(N/K)` orders per driver. Overflow orders are moved to the nearest under-capacity cluster centroid.
- `random_state=72` is fixed for reproducible results during development.

**Why K-Means?** It is fast, well-understood, and produces geographically compact clusters with minimal setup. The Euclidean approximation over lat/lon coordinates is acceptable for city-scale distances (< 50 km).

---

### Module 2 — Route Optimization (`routing.py`)

**Goal:** Find the shortest-time delivery sequence for one driver's assigned orders.

**Algorithm:** Vehicle Routing Problem (VRP) solved with Google OR-Tools, using a real-road duration matrix from OpenRouteService.

```
Input:  List of order locations for one driver
Output: Ordered list of stops [{ stop, order_id, location }, ...]
```

**Implementation details:**

1. Locations are sent to the **ORS Distance Matrix API** (`/v2/matrix/driving-car`), which returns an N×N matrix of driving durations in seconds between every pair of stops.
2. OR-Tools `RoutingModel` is initialized with this matrix.
3. The solver uses the **`PATH_CHEAPEST_ARC`** first-solution strategy — a greedy nearest-neighbour approach that builds a route by repeatedly adding the cheapest next arc. This gives a good solution very quickly.
4. The output is the ordered sequence of node indices mapped back to order IDs.

**Why OR-Tools over pure nearest-neighbour?** OR-Tools is a production-grade constraint solver from Google used in real logistics. Even with `PATH_CHEAPEST_ARC` (no full optimization), it handles edge cases and provides a framework for adding time windows or capacity constraints in future.

**Why ORS over Haversine?** Straight-line distance ignores roads, rivers, and one-way streets. ORS returns actual driving durations, leading to routes that are realistic and drivable.

---

### Module 3 — ETA Calculation (`eta.py`)

**Goal:** Estimate how many minutes from now each stop will be reached.

**Algorithm:** Cumulative travel time from ORS Directions API, plus a fixed service time per stop.

```
Input:  Ordered route from Module 2, service_time (default: 120 seconds)
Output: [{ order_id, minutes_left }, ...]
```

**Implementation details:**

- For each consecutive pair of stops, the ORS Directions API is called to get the driving duration in seconds.
- Cumulative time is tracked across all stops: `eta[i] = eta[i-1] + travel_time(i-1→i) + service_time`.
- `service_time` (default 120 seconds = 2 minutes) accounts for parking, handoff, and signature time.
- Final ETA is converted to minutes and rounded to 2 decimal places.

**Limitation:** ETA is computed once at assignment time and is not recalculated for traffic or delays. See [Known Limitations](#13-known-limitations--future-work).

---

### Pipeline Integration

```python
from clustering import cluster_orders
from routing import optimization_using_or
from eta import calculate_eta

clusters = cluster_orders(orders, num_drivers)

result = {}
for driver_id, driver_orders in clusters.items():
    route = optimization_using_or(driver_orders)
    eta   = calculate_eta(route)
    result[driver_id] = { "route": route, "eta": eta }
```

---

## 10. Database Schema

### `drivers` table

| Column | Type | Description |
|---|---|---|
| `id` | SERIAL PK | Auto-increment ID |
| `name` | VARCHAR | Driver full name |
| `phone` | VARCHAR | Used for driver login |
| `address` | VARCHAR | Home/base address |
| `latitude` | FLOAT | Current GPS latitude |
| `longitude` | FLOAT | Current GPS longitude |
| `status` | VARCHAR | `AVAILABLE` or `ASSIGNED` |

### `orders` table

| Column | Type | Description |
|---|---|---|
| `id` | SERIAL PK | Auto-increment ID |
| `order_name` | VARCHAR | Package/order label |
| `order_size` | VARCHAR | Size descriptor |
| `address` | VARCHAR | Delivery address text |
| `latitude` | FLOAT | Delivery GPS latitude |
| `longitude` | FLOAT | Delivery GPS longitude |
| `status` | VARCHAR | `UNASSIGNED`, `ASSIGNED`, or `DELIVERED` |
| `driver_id` | INT (nullable) | Assigned driver |
| `cluster_id` | INT (nullable) | ML cluster index |
| `sequence_order` | INT (nullable) | Stop number in route |
| `eta` | FLOAT (nullable) | Minutes from optimization time |

> The `database/core_schema.sql` also defines a richer schema with ENUM types, a separate `assignments` table with foreign keys, and spatial indexes on `(latitude, longitude)` columns. The service models use a simplified flat schema for rapid development.

---

## 11. Frontend Guide

### Pages

| Route | Component | Role |
|---|---|---|
| `/` | `RoleSelector` | Landing page — choose Admin or Driver |
| `/admin` | `AdminDashboard` | Full management interface |
| `/driver` | `DriverView` | Driver delivery interface |

### Admin Dashboard

- **Orders tab:** Lists all orders with status badge, ETA, and stop number.
- **Drivers tab:** Lists all drivers with current status.
- **+ New Order / + New Driver:** Inline forms. Click the map to auto-fill coordinates.
- **⚡ Optimize Routes:** Calls `POST /api/orders/optimize`. Draws colour-coded polylines per driver cluster.
- **↻ Refresh:** Re-fetches data without page reload.
- **Metrics bar:** Live counts of total, assigned, delivered orders and driver availability.

### Driver View

- Driver selects their profile from a card grid (all drivers are shown).
- Map shows the driver's pin (green marker) and their assigned stops (coloured circles).
- **Next Stop** bar always shows the next undelivered stop with ETA.
- **Mark Delivered** updates the backend and moves the driver's map pin to the completed stop.
- When all stops are done, a green completion banner appears and the driver is freed.

### MapView Component

`MapView.jsx` handles all map rendering:

- **OSRM route geometry:** Fetches real-road polylines from the public OSRM API, with safety limits (max 1 OSRM request per render, max 8 stops, 8-second timeout, 800-point max per polyline).
- **Fallback:** If OSRM is unavailable, draws straight-line polylines between stops.
- **Geometry caching:** Uses a `ref`-based cache keyed by `driverId|lat,lon|orderIds` to avoid redundant API calls.
- **Backend geometries:** During optimization, the backend also computes and returns OSRM geometries, which take priority over client-side computation.
- **OSRM disabled during form editing** (`enableOsrmRoutes=false`) to keep the UI responsive while placing map pins.

### API Client (`src/api/client.js`)

Two Axios instances with the base URL `/api/orders` and `/api/drivers`. Vite's dev server proxies these to the respective services. In production, replace with an nginx reverse proxy or API gateway.

---

## 12. Key Design Decisions

### Microservices over Monolith

Each service (Order, Driver, ML) is independently deployable and can be scaled separately. The Driver Service and Order Service do not share models — the Order Service calls the Driver Service's REST API to update driver state, following microservice ownership principles.

### Order Service as Orchestrator

Rather than giving the ML service write access to the database, the Order Service acts as the orchestration layer. It fetches data, calls the ML service, and writes results back. This keeps the ML service stateless and easy to replace or upgrade.

### OSRM for Map Visualization, ORS for ML

Two separate routing backends are used deliberately:

- **OSRM** (public, free, no key): used only for rendering road polylines on the map.
- **OpenRouteService** (API key required): used in ML for distance matrices and ETA, because its matrix API is more suitable for multi-point optimization than OSRM's route endpoint.

### Cluster-Index to Driver-ID Mapping

The ML optimizer returns results keyed by cluster index (0, 1, 2…), which are deterministic but not meaningful. The Order Service sorts available drivers by ID and maps `cluster[i] → drivers[i]`. This is simple and predictable but means driver assignment depends on sort order rather than proximity of the driver's starting location to the cluster centroid — a known trade-off noted in Future Work.

### Client-Side OSRM with Safety Rails

The MapView fetches OSRM routes client-side to keep the backend lightweight. Safety limits (1 driver at a time, 8-stop max, 8-second timeout) prevent the browser from freezing on large datasets.

### Driver Location Updates on Delivery

When a stop is marked delivered, the Order Service patches the driver's GPS coordinates to that stop's location via the Driver Service API. This keeps the driver pin accurate on the map without a real GPS integration.

---

## 13. Known Limitations & Future Work

| Area | Current State | Improvement |
|---|---|---|
| Driver assignment | Cluster index → driver ID by sort order | Assign driver whose current location is closest to cluster centroid |
| ETA accuracy | Computed once at optimization time | Recompute dynamically as stops are completed |
| Real-time tracking | Driver pin updated only on delivery | Integrate WebSocket or polling for live GPS |
| Authentication | No login/auth system | Add JWT-based auth for Admin and per-driver login |
| Config management | URLs and keys hardcoded | Move to `.env` files and `python-dotenv` |
| Traffic awareness | ORS uses static road speeds | Use ORS time-dependent routing (traffic data) |
| Scalability | Services use synchronous HTTP calls | Replace inter-service calls with async message queue (e.g., Redis/Celery) |
| Capacity constraints | Orders assumed uniform weight/volume | Add order weight/volume + driver vehicle capacity to VRP |
| Time windows | No delivery time windows | Add time window constraints to OR-Tools VRP model |
| Docker Compose | Manual startup required | Write `docker-compose.yml` to orchestrate all services |

---

## 14. Team Roles

| Member | Area of Responsibility |
|---|---|
| *(Vishesh Kumar Chauhan)* | Order Service — CRUD, Driver Service — CRUD ,optimization orchestration, deliver endpoint |
| *(Abhay Raj Singh)* | OSRM geometry, status management, location update endpoints |
| *(Yash Chaudhary)* | `clustering.py` — K-Means + balancing algorithm |
| *(Yash Chaudhary)* | `routing.py` — OR-Tools VRP integration, ORS distance matrix |
| *(Yash Chaudhary and Abhay Raj Singh)* | `eta.py` — Cumulative ETA calculation, `optimizer_api.py` FastAPI wrapper |
| *(Abhay Raj Singh)* | Admin Dashboard, Driver View, MapView component, OSRM client integration |
| *(Arundhati Brahma/Sukriti)* | Database schema design, seed data, Vite proxy config, API client |


---

## 15. Contributing

1. Fork the repository and create a feature branch: `git checkout -b feature/your-feature-name`
2. Follow existing code style — FastAPI for services, functional React with hooks for frontend.
3. Test your changes locally with all four services running.
4. Submit a pull request with a clear description of changes and any new environment variables.

For bug reports, open an issue with steps to reproduce, expected behaviour, and actual behaviour.

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

*Built as a team project — EcoRoute, 2025.*