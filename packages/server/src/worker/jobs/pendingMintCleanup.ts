import { query } from "../../db/pool.js";

export async function runPendingMintCleanup(): Promise<void> {
  const result = await query(
    "DELETE FROM pending_mints WHERE expires_at < NOW()"
  );
  if (result.rowCount && result.rowCount > 0) {
    console.log(
      `[worker] Cleaned up ${result.rowCount} expired pending mints`
    );
  }
}
