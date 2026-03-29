# Frontend (EcoRoute)

React + Vite UI for EcoRoute delivery optimization microservices.

## Quick Start

1. Navigate to frontend folder:

```powershell
cd d:\ecoroute\frontend
```

2. Install dependencies:

```powershell
npm install
```

3. Run development server:

```powershell
npm run dev
```

4. Open browser:

`http://localhost:5173`

## Proxy Setup

The frontend is configured to proxy `/api` to backend services (order and driver APIs).

- check `vite.config.js` for backend port settings
- order service: `http://localhost:5001`
- driver service: `http://localhost:5002`

## Build

```powershell
npm run build
```

## Project structure

- `src/App.jsx` main app
- `src/pages/RoleSelector.jsx` choose role
- `src/pages/AdminDashboard.jsx` admin view
- `src/pages/DriverView.jsx` driver view
- `src/components/Map/MapView.jsx` map display
- `src/api/client.js` API client utilities
