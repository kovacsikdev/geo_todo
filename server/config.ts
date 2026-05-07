import "dotenv/config";

export const PORT = Number(process.env.PORT ?? 8080);

export const DATABASE_URL =
  process.env.NODE_ENV === "production"
    ? process.env.DATABASE_URL_PROD
    : process.env.DATABASE_URL;

function normalizeOrigin(origin: string): string {
  const trimmed = origin.trim().replace(/\/+$/, "");
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed;
  }
}

const clientOriginEnv =
  process.env.NODE_ENV === "production"
    ? process.env.CLIENT_ORIGIN_PROD || "http://localhost:5173"
    : process.env.CLIENT_ORIGIN || "http://localhost:5173";

export const allowedOrigins = new Set([
  // Additional origins (e.g. Vite dev server, staging domain)
  ...clientOriginEnv
    .split(",")
    .map((origin) => origin.trim())
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean),
]);
