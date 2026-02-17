import test from "node:test";
import assert from "node:assert/strict";
import {
  BOT_MAX_BACKFILL_PER_REQUEST,
  BOT_TARGET_OPPONENT_FLOOR,
  buildBotPool,
  isBotTargetAllowedForPlayer,
  parseBotTargetId,
  withBotBackfill,
} from "../services/arenaBots.js";

test("buildBotPool is deterministic for same player/date", () => {
  const first = buildBotPool("player-a", 14, "2026-02-17");
  const second = buildBotPool("player-a", 14, "2026-02-17");

  assert.deepEqual(first, second);
  assert.ok(first.length > 0);
});

test("parseBotTargetId enforces date and id structure", () => {
  const [bot] = buildBotPool("player-a", 12, "2026-02-17");
  assert.ok(bot);

  const parsed = parseBotTargetId(bot.id, "2026-02-17");
  assert.ok(parsed);
  assert.equal(parsed?.id, bot.id);

  const wrongDate = parseBotTargetId(bot.id, "2026-02-18");
  assert.equal(wrongDate, null);
});

test("withBotBackfill adds at most configured bot count", () => {
  const humans = [
    {
      id: "human-1",
      aiName: "Human One",
      level: 15,
      reputation: 123,
      playstyle: "Balanced",
      alignment: 0,
    },
  ];

  const filled = withBotBackfill("player-a", 15, "2026-02-17", humans);
  const added = filled.length - humans.length;

  assert.ok(added > 0);
  assert.ok(added <= BOT_MAX_BACKFILL_PER_REQUEST);
  assert.ok(filled.length <= BOT_TARGET_OPPONENT_FLOOR);
  assert.equal(filled[0]?.id, "human-1");
  assert.ok(filled.slice(1).every((opp) => opp.id.startsWith("bot:")));
});

test("isBotTargetAllowedForPlayer accepts pool ids and rejects forged ids", () => {
  const playerId = "player-a";
  const playerLevel = 18;
  const dateKey = "2026-02-17";
  const [validBot] = buildBotPool(playerId, playerLevel, dateKey);
  assert.ok(validBot);

  assert.equal(
    isBotTargetAllowedForPlayer(playerId, playerLevel, validBot.id, dateKey),
    true
  );
  assert.equal(
    isBotTargetAllowedForPlayer(playerId, playerLevel, "bot:2026-02-17:elite:18:ffffffff", dateKey),
    false
  );
});
