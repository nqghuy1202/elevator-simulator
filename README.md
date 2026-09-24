# Elevator Simulator

A real-time, multi-elevator building simulator: a Node.js/Socket.IO backend running the dispatch and elevator domain logic, and a React frontend for Hall Call, Car Call, and Door Hold/Close controls, kept in sync over WebSocket.

## Running with Docker (recommended)

Requires Docker with the `docker compose` CLI plugin. From the repo root:

```sh
docker compose up --build
```

Then open **http://localhost:8080** in a browser. The frontend is served by Nginx, which also reverse-proxies Socket.IO traffic to the backend — no other ports need to be open.

Stop the stack with `docker compose down`.

## Running locally without Docker

Requires Node.js 24+.

```sh
npm install
npm start --workspace=backend    # backend on http://localhost:3001
npm run dev --workspace=frontend # frontend on http://localhost:5173
```
