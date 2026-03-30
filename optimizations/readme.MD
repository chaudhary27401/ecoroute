# Delivery Route Optimization Modules – Developer Integration Guide

## Overview

This repository contains the **core optimization logic** for a delivery routing system.
It is designed to be integrated into an existing backend service (e.g., Node.js, Django, FastAPI, Spring Boot).

The project provides **three independent modules**:

1. **clustering.py** – Assigns orders to drivers using geographic clustering.
2. **routing.py** – Optimizes the delivery route for each driver using a Vehicle Routing Problem (VRP) solver.
3. **eta.py** – Calculates estimated delivery time for each stop using real road travel time.

These modules **do not expose API endpoints**. They are intended to be imported into a backend service where endpoints can be created according to the system architecture.

---

# System Workflow

Typical execution pipeline in the backend service:

1. Receive order list and number of drivers
2. Run **clustering** to assign orders to drivers
3. Run **route optimization** for each driver's assigned orders
4. Run **ETA calculation** for each route
5. Return results to the client

Flow:

Orders
→ Clustering (assign drivers)
→ Routing Optimization (optimal order of stops)
→ ETA Calculation (delivery times)

---

# Data Format

Orders should follow this format:

```
{
  "id": 101,
  "order_id": 101,
  "location": [latitude, longitude]
}
```

Example list:

```
orders = [
    {"id":1, "order_id":1, "location":[28.7041,77.1025]},
    {"id":2, "order_id":2, "location":[28.7055,77.1052]},
    {"id":3, "order_id":3, "location":[28.7090,77.1003]}
]
```

---

# Module 1 — Clustering

File: **clustering.py**

### Purpose

Distributes orders across drivers using **K-Means clustering** so geographically close deliveries are assigned to the same driver.

### Function

```
cluster_orders(orders, num_drivers)
```

### Parameters

| Parameter   | Type | Description                 |
| ----------- | ---- | --------------------------- |
| orders      | list | list of order dictionaries  |
| num_drivers | int  | number of available drivers |

### Returns

```
{
    driver_id: [order_objects]
}
```

Example output:

```
{
    0: [order1, order2],
    1: [order3, order4]
}
```

### Implementation Details

The algorithm performs:

1. Convert order locations into coordinate matrix
2. Run **K-Means clustering**
3. Assign each order to a cluster
4. Balance clusters to ensure drivers receive a similar number of orders

Cluster balancing is handled by:

```
balance_clusters()
```

This ensures that no driver receives significantly more orders than others.

---

# Module 2 — Route Optimization

File: **routing.py**

### Purpose

Determines the **optimal delivery sequence** for a driver's assigned orders.

The routing uses:

* **Google OR-Tools**
* **OpenRouteService distance matrix**

This provides realistic road travel time rather than simple geometric distance.

### Function

```
optimization_using_or(cluster_orders)
```

### Parameters

| Parameter      | Type | Description                   |
| -------------- | ---- | ----------------------------- |
| cluster_orders | list | orders assigned to one driver |

### Returns

Ordered route:

```
[
  {
    "stop": 1,
    "order_id": 1,
    "location": [lat, lon]
  },
  {
    "stop": 2,
    "order_id": 4,
    "location": [lat, lon]
  }
]
```

### Implementation Details

Steps:

1. Extract order locations
2. Request **distance matrix** from OpenRouteService
3. Build **VRP model using OR-Tools**
4. Use **PATH_CHEAPEST_ARC strategy** to compute route
5. Return ordered stops

Distance matrix is created using:

```
create_distance_matrix(locations)
```

which internally calls:

```
ors_matrix(locations)
```

---

# Module 3 — ETA Calculation

File: **eta.py**

### Purpose

Estimates the **remaining delivery time for each stop**.

Uses:

* OpenRouteService routing API
* Configurable service time per order

### Function

```
calculate_eta(route, service_time=120)
```

### Parameters

| Parameter    | Type | Description                        |
| ------------ | ---- | ---------------------------------- |
| route        | list | ordered route from routing module  |
| service_time | int  | time spent at each stop in seconds |

Default service time:

```
120 seconds
```

### Returns

```
[
  {"order_id":1,"minutes_left":3.2},
  {"order_id":2,"minutes_left":8.7}
]
```

### Implementation Details

For each stop:

1. Compute travel time from previous stop
2. Add travel time to cumulative ETA
3. Add service time
4. Convert to minutes

Travel time is obtained using:

```
get_travel_time(origin, destination)
```

which queries the **OpenRouteService Directions API**.

---

# Example Integration Flow

A backend service can orchestrate the modules as follows:

```
from clustering import cluster_orders
from routing import optimization_using_or
from eta import calculate_eta

clusters = cluster_orders(orders, drivers)

for driver_id, driver_orders in clusters.items():

    route = optimization_using_or(driver_orders)

    eta = calculate_eta(route)

    result[driver_id] = {
        "route": route,
        "eta": eta
    }
```

The backend service can then return this data via its API.

---

# Optimizer HTTP Service (FastAPI)

You can run a dedicated optimizer endpoint from `optimizations/optimizer_api.py`:

```powershell
cd d:\ecoroute\optimizations
pip install fastapi uvicorn
uvicorn optimizer_api:app --host 0.0.0.0 --port 8000 --reload
```

Endpoints:

- `GET /health` → status check
- `POST /optimize` → payload `{ "orders": [ {"id": 1, "location": [lat, lon] }, ...], "num_drivers": 2 }`

Integrate from order service in `services/order-service/routers/order.py` (`/orders/optimize`) by calling:

```python
requests.post('http://localhost:8000/optimize', json={...})
```

---

# External Dependencies

Required libraries:

```
scikit-learn
numpy
ortools
openrouteservice
```

Install using:

```
pip install scikit-learn numpy ortools openrouteservice
```

---

# API Key Requirement

The routing and ETA modules require an **OpenRouteService API key**.

Replace the key in:

```
routing.py
eta.py
```

Example:

```
API_KEY = "YOUR_OPENROUTESERVICE_KEY"
```

Register for a key at:

https://openrouteservice.org/

---

# Expected Backend Endpoint (Example)

Backend developers may create an endpoint similar to:

```
POST /optimize-delivery
```

Request:

```
{
  "drivers": 3,
  "orders": [...]
}
```

Response:

```
{
  "driver_assignments": [...],
  "routes": [...],
  "eta": [...]
}
```

The exact API design depends on the backend architecture.

---

# Performance Notes

The system is designed for **last-mile delivery optimization** with:

* tens to hundreds of orders
* multiple drivers
* real road travel times

Performance considerations:

* ORS API calls can become a bottleneck for very large batches
* distance matrix requests should be monitored for rate limits

---

# Repository Structure

```
optimizer/
│
├── clustering.py
├── routing.py
├── eta.py
└── README.md
```

---

# Responsibility Boundary

This repository focuses only on:

* optimization logic
* clustering
* route planning
* ETA estimation

Backend responsibilities include:

* API creation
* request validation
* authentication
* database integration
* caching
* scaling and orchestration

---

# Use Cases

* food delivery platforms
* courier delivery optimization
* hyperlocal logistics
* last-mile distribution systems

---
