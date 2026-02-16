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
import { STARTING_RESOURCES, getUnlockedSystems, SANDBOX_EXIT_LEVEL } from "@singularities/shared";
import { computeSystemHealth } from "../services/maintenance.js";
import { getActiveModifierEffects, getTodayModifier } from "../services/modifiers.js";
import { materializePassiveIncome } from "../services/passive.js";

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

      // Materialize passive income if last active > 5 min ago
      const lastActive = new Date(playerResult.rows[0].last_active_at as string).getTime();
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      const passiveIncome = lastActive < fiveMinAgo
        ? await materializePassiveIncome(playerId)
        : null;

      // Re-read player if passive income was awarded (credits/data changed)
      const finalPlayerResult = passiveIncome
        ? await query("SELECT * FROM players WHERE id = $1", [playerId])
        : playerResult;

      const row = computeEnergy(finalPlayerResult.rows[0]);
      const player = mapPlayerRow(row);
      const [modifierEffects, activeModifier] = await Promise.all([
        getActiveModifierEffects(),
        getTodayModifier(),
      ]);

      return {
        player,
        systems: systemsResult.rows.map((r) => mapSystemRow(computeSystemHealth(r, modifierEffects))),
        modules: modulesResult.rows.map(mapModuleRow),
        loadouts: loadoutsResult.rows.map(mapLoadoutRow),
        unlockedSystems: getUnlockedSystems(player.level, player.isInSandbox),
        passiveIncome,
        activeModifier,
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

  // Exit sandbox mode
  app.post(
    "/api/players/exit-sandbox",
    { preHandler: [authGuard] },
    async (request, reply) => {
      const { sub: playerId } = request.user as AuthPayload;

      const result = await query("SELECT * FROM players WHERE id = $1", [
        playerId,
      ]);
      if (result.rows.length === 0) {
        return reply.code(404).send({
          error: "Not Found",
          message: "Player not found",
          statusCode: 404,
        });
      }

      const row = result.rows[0];
      if (!(row.is_in_sandbox as boolean)) {
        return reply.code(400).send({
          error: "Bad Request",
          message: "Player is not in sandbox mode",
          statusCode: 400,
        });
      }

      if ((row.level as number) < SANDBOX_EXIT_LEVEL) {
        return reply.code(400).send({
          error: "Bad Request",
          message: `Must be level ${SANDBOX_EXIT_LEVEL} to exit sandbox`,
          statusCode: 400,
        });
      }

      await query("UPDATE players SET is_in_sandbox = false WHERE id = $1", [
        playerId,
      ]);

      const updated = await query("SELECT * FROM players WHERE id = $1", [
        playerId,
      ]);

      return { player: mapPlayerRow(computeEnergy(updated.rows[0])) };
    }
  );
}
