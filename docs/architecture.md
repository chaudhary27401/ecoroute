# EcoRoute Architecture and API Reference

## Purpose

This document describes the components of the EcoRoute system and how the new frontend integrates with the existing microservices backend.

## Components

- `services/driver-service` (port 5002): driver registration and lookup.
- `services/order-service` (port 5001): order management and optimization orchestration.
- `backend` or `ml_engine` (port 8000): route optimization + ETA calculation engine that uses K-Means clustering, nearest neighbor + 2-opt routes, and Ridge regression ETA.
- `frontend` (port 5173): React app proxies `/api` to `http://localhost:5001`.

## Order optimization flow

1. Admin POST `/api/orders/optimize` (via frontend).
2. Order service fetches unassigned orders and active drivers (via driver service).
3. Order service posts to ML optimizer (`http://localhost:8000/optimize`).
4. ML returns assignments; order-service writes driver assignments and ETA into DB.
5. Driver can GET `/api/orders/driver/{driver_id}` to view route stops.

## Frontend

- `src/api/client.js` uses Axios with `baseURL: '/api'`.
- Admin page displays orders and drivers + optimize button.
- Driver page logs in by phone, displays assigned orders, and marks delivery.
