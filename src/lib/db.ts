import { Pool } from "pg";
import { env } from "./env";

const globalForDb = globalThis as unknown as { pool: Pool };

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: env.POSTGRES_URL,
    ssl: env.POSTGRES_URL.includes("localhost") ? false : { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;
