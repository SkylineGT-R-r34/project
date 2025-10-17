import dotenv from "dotenv";
import pg from "pg";
import { newDb } from "pg-mem";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const { Pool } = pg;

function hasConnectionConfig() {
  return Boolean(
    process.env.DATABASE_URL ||
    process.env.PGHOST ||
    process.env.PGUSER ||
    process.env.PGDATABASE
  );
}

function createRealPool() {
  const { DATABASE_URL, PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT, PGSSLMODE } = process.env;

  if (DATABASE_URL) {
    return new Pool({
      connectionString: DATABASE_URL,
      ssl: PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
    });
  }

  return new Pool({
    host: PGHOST,
    user: PGUSER,
    password: PGPASSWORD,
    database: PGDATABASE,
    port: PGPORT ? Number(PGPORT) : undefined,
    ssl: PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
  });
}

function createInMemoryPool() {
  const db = newDb({ autoCreateForeignKeyIndices: true });

  // Align with PostgreSQL current_timestamp behaviour used in schema defaults
  db.public.registerFunction({
    name: "current_timestamp",
    returns: "timestamp",
    implementation: () => new Date(),
  });

  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  const schemaPath = path.resolve(__dirname, "./init/001_init.sql");
  if (fs.existsSync(schemaPath)) {
    const schemaSQL = fs.readFileSync(schemaPath, "utf8");
    db.public.none(schemaSQL);
  }

  const dummyPath = path.resolve(__dirname, "./dummy/002_init.sql");
  if (fs.existsSync(dummyPath)) {
    const dummySQL = fs.readFileSync(dummyPath, "utf8");
    db.public.none(dummySQL);
  }

  const { Pool: MemPool } = db.adapters.createPg();
  return new MemPool();
}

const pool = hasConnectionConfig() ? createRealPool() : createInMemoryPool();

export default pool;

