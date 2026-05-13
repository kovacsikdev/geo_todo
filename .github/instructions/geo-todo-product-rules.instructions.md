---
description: "Use when implementing or modifying geo-todo route behavior (/ and /app), trip ownership and guest access rules, DB persistence, or real-time sync via SSE."
name: "Geo Todo Product Rules"
---
# Geo Todo Product Rules

- Treat all items below as hard requirements unless the user explicitly asks to override them.
- Preserve the route contract:
  - `/` is a landing page that describes the app and links users to `/app`.
  - `/app` is the SPA containing the map experience and TODO list.
- Preserve the trip access model:
  - Creating a trip generates a new `ownerId` and `guestId`.
  - Both IDs are persisted in the database.
  - Guests are read-only.
  - Owners can perform full CRUD on trip data.
- Enforce authorization server-side:
  - Never trust client-side role flags alone.
  - Validate owner credentials for every write operation.
  - Reject guest write attempts with explicit forbidden errors.
- Preserve real-time data flow:
  - Persist owner updates in DB before notifying clients.
  - After persistence, notify all guests in real time through SSE.
  - Ensure SSE payloads are authoritative enough to keep clients in sync.
- Keep client and server contracts aligned:
  - When changing trip data shape or API responses, update both client and server in the same change.
  - Avoid breaking existing IDs or route assumptions unless a migration path is included.
- Keep the landing-to-app navigation path intact unless explicitly requested to change it.
