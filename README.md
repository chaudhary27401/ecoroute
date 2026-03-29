# EcoRoute — Intelligent Delivery Optimizer

A microservices-based delivery routing application with Order Service, Driver Service and an ML optimization engine.

## Architecture

- `services/order-service`: Order CRUD + cluster assignment orchestration.
- `services/driver-service`: Driver CRUD + status tracking.
- `ml_engine` or `backend` (your model service): Route clustering, optimization, ETA calculations.
- `frontend`: React + Leaflet UI consuming `order-service` and `driver-service`.

## Quick Start (Windows)

### 1. Start PostgreSQL

Use Docker:

```powershell
docker run -d --name ecoroute-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ecoroute -p 5432:5432 postgres:16
```

### 2. Start Driver Service

```powershell
cd d:\ecoroute\services\driver-service
env\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5002 --reload
```

### 3. Start Order Service

```powershell
cd d:\ecoroute\services\order-service
env\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5001 --reload
```

### 4. Start ML/Optimizer Service

If your repo has `backend`, run similarly on port 8000. If not, point to an existing optimizer at `http://localhost:8000/optimize`.

### 5. Start Frontend

```powershell
cd d:\ecoroute\frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## API Endpoints

### Driver Service (`http://localhost:5002`)
- `POST /drivers/` create driver
- `GET /drivers/` list drivers
- `GET /drivers/login?phone=...` fetch driver by phone

### Order Service (`http://localhost:5001`)
- `GET /orders/` list orders
- `POST /orders/` create order
- `POST /orders/optimize` trigger clustering + assignment
- `GET /orders/driver/{driver_id}` list assigned orders by driver
- `PATCH /orders/{order_id}/deliver` mark delivered

## Frontend Integration

The front-end calls services through Vite proxy `/api`:
- `/api/drivers/...` → `driver-service`
- `/api/orders/...` → `order-service`

## ML flow (optimizer service)

- Fetch unassigned orders from `order-service`
- Get active drivers from `driver-service`
- Run k-means + route optimizer + ETA predictor
- Return route assignment structure to `order-service`

## Notes

- This repo supports both single-stack (all services in one project) and split-mode (separate service host/ports).
- If you use an optimizer service on another host/port, change the address in `services/order-service/routers/order.py` while calling ML endpoint from `/optimize`.
- Use `docker-compose` if you prefer predefined service bindings (create `docker-compose.yml` with drivers/order/ml services and Postgres).

## Docs

- `services/order-service/routers/order.py`: orchestration for clustering and assignment.
- `services/driver-service/routers/driver.py`: drivers API.
- `frontend/src`: React UI that consumes APIs and offers Admin + Driver views.
 
