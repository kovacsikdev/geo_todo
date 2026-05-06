import express from "express";
import { allowedOrigins, PORT } from "./config.js";
import { initializeDatabase } from "./db.js";
import { createCorsGuard } from "./middleware/corsGuard.js";
import { registerApiRoutes } from "./routes/apiRoutes.js";

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(createCorsGuard(allowedOrigins));

registerApiRoutes(app);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

async function bootstrap(): Promise<void> {
  await initializeDatabase();

  app.listen(PORT, () => {
    console.log(`Geo Todo server running on http://localhost:${PORT}`);
    console.log(`SSE endpoint:          http://localhost:${PORT}/api/events`);
    console.log(`Trip actions endpoint: http://localhost:${PORT}/api/trip`);
    console.log(`Allowed origins: ${Array.from(allowedOrigins).join(", ")}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start Geo Todo server", error);
  process.exit(1);
});
