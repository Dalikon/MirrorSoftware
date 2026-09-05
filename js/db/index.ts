import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.js";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

// __dirname resolves to js/db/ — migrations live next to this file in ./migrations/
const migrationsFolder = join(__dirname, "migrations");

let _db: Db | null = null;

/**
 * Opens the SQLite database at dbPath, enables WAL mode and foreign keys,
 * and applies any pending migrations. Call once at startup before getDb().
 * Pass ":memory:" in tests for a fresh in-memory database.
 */
export function initDb(dbPath: string): Db {
	const sqlite = new Database(dbPath);
	sqlite.pragma("journal_mode = WAL");
	sqlite.pragma("foreign_keys = ON");

	_db = drizzle(sqlite, { schema });
	migrate(_db, { migrationsFolder });

	return _db;
}

export function getDb(): Db {
	if (!_db) throw new Error("Database not initialized — call initDb() first");
	return _db;
}
