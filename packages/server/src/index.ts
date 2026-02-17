import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { env } from "./lib/env.js";
import { pool } from "./db/pool.js";
import { redis } from "./db/redis.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { playerRoutes } from "./routes/player.js";
import { scannerRoutes } from "./routes/scanner.js";
import { moduleRoutes } from "./routes/modules.js";
import { loadoutRoutes } from "./routes/loadouts.js";
import { modifierRoutes } from "./routes/modifiers.js";
import { maintenanceRoutes } from "./routes/maintenance.js";
import { scriptRoutes } from "./routes/scripts.js";
import { arenaRoutes } from "./routes/arena.js";
import { securityRoutes } from "./routes/security.js";
import { worldRoutes } from "./routes/world.js";
import { decisionRoutes } from "./routes/decisions.js";
import { mutationRoutes } from "./routes/mutations.js";
import { seasonRoutes } from "./routes/seasons.js";
import { startWorker, stopWorker } from "./worker/index.js";

const app = Fastify({
  logger: {
    level: "info",
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  },
});

// Plugins
await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
await app.register(jwt, { secret: env.JWT_SECRET });

// Extend Fastify types for JWT
declare module "fastify" {
  interface FastifyInstance {
    authenticate: typeof import("./middleware/auth.js").authGuard;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; wallet: string };
    user: { sub: string; wallet: string };
  }
}

// Routes
await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(playerRoutes);
await app.register(scannerRoutes);
await app.register(moduleRoutes);
await app.register(loadoutRoutes);
await app.register(modifierRoutes);
await app.register(maintenanceRoutes);
await app.register(scriptRoutes);
await app.register(arenaRoutes);
await app.register(securityRoutes);
await app.register(worldRoutes);
await app.register(decisionRoutes);
await app.register(mutationRoutes);
await app.register(seasonRoutes);

// Start
try {
  // Test database connection
  await pool.query("SELECT 1");
  console.log("Database connected");

  // Test Redis connection
  await redis.connect();
  await redis.ping();
  console.log("Redis connected");

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  console.log(`Server running on port ${env.PORT}`);

  // Start background worker after server is listening
  startWorker();
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// Graceful shutdown
const shutdown = async () => {
  console.log("Shutting down...");
  stopWorker();
  await app.close();
  await pool.end();
  redis.disconnect();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
