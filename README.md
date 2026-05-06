# Geo Todo

Collaborative, map-based trip todo app in a simple monorepo:

- `client/`: Vite + React + TypeScript SPA (Mapbox map, PWA assets)
- `server/`: Express + TypeScript API with SSE for real-time trip updates

## Features

- Create a trip as owner and share its trip ID
- Join an existing trip as guest using the trip ID
- Location-based todo lists on an interactive map
- Real-time updates using Server-Sent Events (SSE)
- MySQL persistence for trip data
- Owner/guest role behavior (guests are read-only)

## Project Structure

```text
geo-todo/
  client/   # React app
  server/   # Express API + SSE
  package.json
```

## Requirements

- Node.js 20+
- MySQL database
- Mapbox token (for map rendering)

## Setup

1. Install dependencies:

```bash
npm install
npm install --prefix server
npm install --prefix client
```

2. Configure environment variables.

Create `server/.env`:

```bash
PORT=8080
DATABASE_URL=mysql://USER:PASSWORD@localhost:3306/geo_todo
CLIENT_ORIGIN=http://localhost:5173
```

Optional production server variables:

```bash
DATABASE_URL_PROD=mysql://USER:PASSWORD@HOST:3306/geo_todo
CLIENT_ORIGIN_PROD=https://your-client-domain.com
```

Create `client/.env`:

```bash
VITE_SERVER_URL=http://localhost:8080
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_access_token
```

## Run Locally

From repo root:

```bash
npm run dev
```

- Client: `http://localhost:5173`
- Server: `http://localhost:8080`
- Health check: `http://localhost:8080/health`

The server creates the `trips` table automatically on startup if it does not exist.

## Real-Time Protocol (SSE)

- Connect to events stream: `GET /api/events`
- Send trip actions: `POST /api/trip`
- Guests join with connection context: `POST /api/trip?connectionId=<id>`

Supported actions:

- `createTrip`
- `joinTrip`
- `updateTrip`
- `deleteTrip`

Incoming event message types:

- `connected`
- `tripState`
- `tripDeleted`
- `response`

## Scripts

Root:

- `npm run dev` - run server + client
- `npm run dev:server` - run server only
- `npm run dev:client` - run client only
- `npm run build` - build server + client
- `npm start` - run built server (`server/dist/index.js`)

Server (`server/`):

- `npm run dev` - `tsx watch index.ts`
- `npm run build` - TypeScript compile
- `npm run start` - run compiled server

Client (`client/`):

- `npm run dev` - Vite dev server
- `npm run build` - TypeScript + Vite build
- `npm run lint` - ESLint
