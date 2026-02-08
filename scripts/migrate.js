/**
 * Run DB migrations. Uses POSTGRES_URL from env.
 * Usage: POSTGRES_URL="postgres://..." node scripts/migrate.js
 */
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const url = process.env.POSTGRES_URL;
if (!url || url.includes("placeholder") || url.includes("localhost")) {
  console.error("Set POSTGRES_URL to your hosted Postgres connection string.");
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
