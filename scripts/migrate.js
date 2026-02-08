/**
 * Run DB migrations. Uses POSTGRES_URL from .env.local or env.
 * Usage: npm run db:migrate   (reads .env.local)
 *    or: POSTGRES_URL="postgres://..." npm run db:migrate
 */
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

// Load .env.local so npm run db:migrate works without passing POSTGRES_URL
const envPath = path.join(__dirname, "..", ".env.local");
try {
  const env = fs.readFileSync(envPath, "utf8");
  for (const line of env.split("\n")) {
    const eq = line.indexOf("=");
    if (eq > 0) {
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
        value = value.slice(1, -1);
      process.env[key] = value;
    }
  }
} catch {
  // .env.local optional if POSTGRES_URL already set
}

const url = process.env.POSTGRES_URL;
if (!url || url.includes("placeholder")) {
  console.error("Set POSTGRES_URL in .env.local or run: POSTGRES_URL=\"...\" npm run db:migrate");
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
});

async function runFile(name) {
  const filePath = path.join(__dirname, "..", "db", name);
  const sql = fs.readFileSync(filePath, "utf8");
  await pool.query(sql);
  console.log("Ran", name);
}

async function main() {
  try {
    await runFile("schema.sql");
    console.log("Done. Tables ready.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
