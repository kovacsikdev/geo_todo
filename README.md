# Geo Todo

Geo Todo, branded in the UI as Map Itinerary, is a collaborative trip-planning app built around a live map. Owners can create a trip, add locations directly from the map, attach task lists to each stop, and share a Guest ID for read-only collaboration. Guests see updates in real time without needing an account.

The project is a small monorepo with:

- `client/`: Vite + React + TypeScript SPA with Mapbox and PWA support
- `server/`: Express + TypeScript API with MySQL persistence and Server-Sent Events (SSE)

## What The App Does

Geo Todo is designed for planning travel, errands, or multi-stop itineraries in a way that feels map-first instead of list-first. The landing page lives at `/`, and the full app experience lives at `/app`.

Core workflow:

1. Create a trip.
2. The app generates an Owner ID and a Guest ID.
3. Rejoin the trip later using either ID.
4. Add locations by clicking the map.
5. Organize tasks under each location.
6. Share the Guest ID with collaborators who only need live viewing access.

## Major Features

### Collaboration and persistence

- Owner and guest access model with no account required
- Join trips using Owner ID or Guest ID
- Auto-rejoin the last successful session after refresh
- MySQL-backed persistence for trip state
- Real-time sync over SSE so guests stay up to date immediately
- Owner-only mutations enforced server-side
- Delete trip support for permanent cleanup

### Map and trip planning

- Interactive Mapbox map focused on location-based planning
- Add locations by clicking directly on the map
- Suggested location names from clicked map features
- Address capture when Mapbox can resolve one
- Existing locations rendered as clickable map markers
- Zoom to a selected location from the side panel
- Search for places and addresses inside the current viewport with fallback outside the viewport
- Search result marker placement without forcing an add-location popup

### Directions and navigation

- Driving and walking directions from the user’s current location
- Route overview before turn-by-turn follow mode begins
- Explicit Begin button for directions instead of auto-follow immediately
- Follow camera behavior for active navigation
- Dashed walking route styling for better visual separation from driving routes

### Task and board management

- Task lists scoped to each saved location
- Add, edit, toggle, reorder, and delete tasks
- Reorder locations in the trip board
- Delete confirmations for locations and tasks
- Collapsible location cards for easier scanning on longer trips
- Fixed overlay dialogs for directions and location editing within the side menu experience

### Mobile and PWA experience

- Installable PWA configuration for the `/app` route
- In-app install prompt/banner support
- Service worker and manifest setup for installability
- Mobile-friendly map interaction and reduced camera jitter during live location tracking
- Safe-area aware layout behavior for smaller screens and phones

## Project Structure

```text
geo-todo/
  client/   # React app, routing, map UI, PWA assets
  server/   # Express API, SSE transport, MySQL persistence
  package.json
```

## Tech Stack

- React 19
- TypeScript
- Vite
- Mapbox GL JS
- Express 5
- MySQL
- Server-Sent Events (SSE)

## Requirements

- Node.js 20+
- MySQL database
- Mapbox access token

## Local Setup

### 1. Install dependencies

From the repo root:

```bash
npm install
npm install --prefix server
npm install --prefix client
```

### 2. Configure environment variables

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

### 3. Start the app

From the repo root:

```bash
npm run dev
```

Local URLs:

- Client: `http://localhost:5173`
- App route: `http://localhost:5173/app`
- Server: `http://localhost:8080`
- Health check: `http://localhost:8080/health`

The server creates the `trips` table automatically on startup if it does not already exist.

## Available Scripts

### Root

- `npm run dev` - run server and client together
- `npm run dev:server` - run only the server
- `npm run dev:client` - run only the client
- `npm run build` - build both server and client
- `npm start` - run the built server from `server/dist/index.js`

### Server (`server/`)

- `npm run dev` - start the API with `tsx watch`
- `npm run build` - compile the server with TypeScript
- `npm run start` - run the compiled server

### Client (`client/`)

- `npm run dev` - start the Vite dev server
- `npm run build` - type-check and build the client
- `npm run lint` - run ESLint

## Real-Time API Overview

The app uses SSE for server-to-client updates and regular HTTP POST requests for actions.

- Connect to the events stream: `GET /api/events`
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
