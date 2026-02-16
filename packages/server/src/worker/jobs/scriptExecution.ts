import { acquireLock, releaseLock } from "../lock.js";
import { evaluateAndExecuteScripts } from "../../services/scripts.js";

const LOCK_KEY = "worker:script_execution";
const LOCK_TTL = 120_000; // 2 min

export async function runScriptExecution(): Promise<void> {
  const token = await acquireLock(LOCK_KEY, LOCK_TTL);
  if (!token) return;

  try {
    await evaluateAndExecuteScripts();
  } finally {
    await releaseLock(LOCK_KEY, token);
  }
}
