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
      if (!result.ok) {
        const errorMessage = typeof result.error === "string" ? result.error : "Request failed.";
        if (errorMessage.toLowerCase().startsWith("forbidden")) {
          res.status(403).json(result);
          return;
        }

        if (errorMessage.toLowerCase().includes("not found")) {
          res.status(404).json(result);
          return;
        }

        res.status(400).json(result);
        return;
      }

      res.status(200).json(result);
    } catch {
      res.status(500).json({ error: "Internal server error." });
    }
  });
}
