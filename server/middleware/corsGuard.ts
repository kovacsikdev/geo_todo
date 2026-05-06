import type { RequestHandler } from "express";
import {
  applyCorsHeaders,
  handleCorsPreflight,
  isOriginAllowed,
} from "../cors.js";

export function createCorsGuard(allowedOrigins: Set<string>): RequestHandler {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (!isOriginAllowed(origin, allowedOrigins)) {
      res.status(403).json({ error: "Origin is not allowed." });
      return;
    }

    applyCorsHeaders(res, origin, allowedOrigins);

    if (handleCorsPreflight(req, res)) {
      return;
    }

    next();
  };
}
