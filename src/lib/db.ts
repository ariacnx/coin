import { Pool } from "pg";
import { env } from "./env";

const globalForDb = globalThis as unknown as { pool: Pool };

const isLocalhost =
  env.POSTGRES_URL.includes("localhost") || env.POSTGRES_URL.includes("127.0.0.1");

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: env.POSTGRES_URL,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;
