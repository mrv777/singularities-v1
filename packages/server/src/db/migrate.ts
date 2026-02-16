import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool, query } from "./pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await query<{ name: string }>(
    "SELECT name FROM _migrations ORDER BY id"
  );
  return new Set(result.rows.map((r) => r.name));
}

async function migrate() {
  console.log("Running database migrations...");

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  [skip] ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    console.log(`  [run]  ${file}`);

    await query("BEGIN");
    try {
      await query(sql);
      await query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      await query("COMMIT");
      count++;
    } catch (err) {
      await query("ROLLBACK");
      console.error(`  [FAIL] ${file}:`, err);
      process.exit(1);
    }
  }

  console.log(
    count > 0
      ? `Applied ${count} migration(s).`
      : "No new migrations to apply."
  );
  await pool.end();
}

migrate();
