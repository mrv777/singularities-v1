import type { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import { handleConnection } from "../services/ws.js";
import { query } from "../db/pool.js";

export async function wsRoutes(app: FastifyInstance) {
  await app.register(websocket);

  app.get("/ws", { websocket: true }, async (socket, request) => {
    // Auth via query param token
    const token = (request.query as Record<string, string>).token;
    if (!token) {
      socket.close(4001, "Missing token");
      return;
    }

    try {
      const payload = app.jwt.verify<{ sub: string; wallet: string }>(token);
      const playerId = payload.sub;

      // Fetch player info
      const res = await query(
        "SELECT ai_name, level, alignment FROM players WHERE id = $1 AND is_alive = true",
        [playerId]
      );

      if (res.rows.length === 0) {
        socket.close(4003, "Player not found");
        return;
      }

      const row = res.rows[0];
      await handleConnection(
        socket,
        playerId,
        row.ai_name as string,
        row.level as number,
        (row.alignment as number) ?? 0
      );
    } catch {
      socket.close(4001, "Invalid token");
    }
  });
}
