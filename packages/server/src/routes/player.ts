import type { FastifyInstance } from "fastify";
import { authGuard, type AuthPayload } from "../middleware/auth.js";
import { query } from "../db/pool.js";
import {
  computeEnergy,
  mapPlayerRow,
  mapSystemRow,
  mapModuleRow,
  mapLoadoutRow,
} from "../services/player.js";
import { STARTING_RESOURCES } from "@singularities/shared";

export async function playerRoutes(app: FastifyInstance) {
  // Get current player profile (protected)
  app.get(
    "/api/player/me",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;

      const [playerResult, systemsResult, modulesResult, loadoutsResult] =
        await Promise.all([
          query("SELECT * FROM players WHERE id = $1", [playerId]),
          query("SELECT * FROM player_systems WHERE player_id = $1", [
            playerId,
          ]),
          query("SELECT * FROM player_modules WHERE player_id = $1", [
            playerId,
          ]),
          query("SELECT * FROM player_loadouts WHERE player_id = $1", [
            playerId,
          ]),
        ]);

      if (playerResult.rows.length === 0) {
        return reply.code(404).send({
          error: "Not Found",
          message: "Player not found",
          statusCode: 404,
        });
      }

      const row = computeEnergy(playerResult.rows[0]);

      return {
        player: mapPlayerRow(row),
        systems: systemsResult.rows.map(mapSystemRow),
        modules: modulesResult.rows.map(mapModuleRow),
        loadouts: loadoutsResult.rows.map(mapLoadoutRow),
      };
    }
  );

  // Register AI (mock mint)
  app.post(
    "/api/players/register",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId, wallet } = request.user as AuthPayload;
      const { aiName } = request.body as { aiName: string };

      // Validate name
      if (!aiName || typeof aiName !== "string") {
        return reply.code(400).send({
          error: "Validation",
          message: "AI name is required",
          statusCode: 400,
        });
      }

      const trimmed = aiName.trim();
      if (trimmed.length < 2 || trimmed.length > 20) {
        return reply.code(400).send({
          error: "Validation",
          message: "AI name must be 2-20 characters",
          statusCode: 400,
        });
      }

      if (!/^[a-zA-Z0-9 ]+$/.test(trimmed)) {
        return reply.code(400).send({
          error: "Validation",
          message: "AI name must be alphanumeric (spaces allowed)",
          statusCode: 400,
        });
      }

      // Check player exists and doesn't already have a mint
      const existing = await query("SELECT * FROM players WHERE id = $1", [
        playerId,
      ]);
      if (existing.rows.length === 0) {
        return reply.code(404).send({
          error: "Not Found",
          message: "Player not found",
          statusCode: 404,
        });
      }

      if (existing.rows[0].mint_address) {
        return reply.code(400).send({
          error: "Already Registered",
          message: "AI already registered",
          statusCode: 400,
        });
      }

      // Generate placeholder mint
      const mintAddress = `mock_mint_${wallet.slice(0, 8)}_${Date.now()}`;

      // Update player
      await query(
        `UPDATE players
         SET ai_name = $2,
             mint_address = $3,
             credits = $4,
             data = $5,
             processing_power = $6
         WHERE id = $1`,
        [
          playerId,
          trimmed,
          mintAddress,
          STARTING_RESOURCES.credits,
          STARTING_RESOURCES.data,
          STARTING_RESOURCES.processingPower,
        ]
      );

      // Create default infiltration loadout (3 empty slots)
      for (let slot = 1; slot <= 3; slot++) {
        await query(
          `INSERT INTO player_loadouts (player_id, loadout_type, slot)
           VALUES ($1, 'infiltration', $2)
           ON CONFLICT (player_id, loadout_type, slot) DO NOTHING`,
          [playerId, slot]
        );
      }

      const updated = await query("SELECT * FROM players WHERE id = $1", [
        playerId,
      ]);

      return { player: mapPlayerRow(computeEnergy(updated.rows[0])) };
    }
  );
}
