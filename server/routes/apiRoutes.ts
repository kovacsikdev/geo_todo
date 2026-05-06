import type { Express } from "express";
import { handleSSEConnection, handleTripAction } from "../sseServer.js";

export function registerApiRoutes(app: Express): void {
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", secure: false });
  });

  app.get("/api/events", (req, res) => {
    handleSSEConnection(req, res);
  });

  app.post("/api/trip", async (req, res) => {
    const raw = req.query.connectionId;
    const connectionId =
      typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;

    try {
      const result = await handleTripAction(req.body, connectionId);
      res.status(200).json(result);
    } catch {
      res.status(500).json({ error: "Internal server error." });
    }
  });
}
