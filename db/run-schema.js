// Runs db/schema.sql against SQL Server without needing the sqlcmd CLI.
// schema.sql uses "GO" batch separators (SSMS/sqlcmd convention) which are
// NOT valid T-SQL — they have to be split out and run as separate batches.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sql = require('mssql');

async function run() {
  const filePath = path.join(__dirname, 'schema.sql');
  const fileText = fs.readFileSync(filePath, 'utf8');

  // Split on lines that are just "GO" (case-insensitive, optional whitespace)
  const batches = fileText
    .split(/^\s*GO\s*$/gim)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  // Connect to the server without pinning to a database yet, since the
  // first batch creates the simple_erp database itself.
  const config = {
    server: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '1433', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true },
  };

  const pool = await new sql.ConnectionPool(config).connect();
  try {
    for (const batch of batches) {
      await pool.request().query(batch);
    }
    console.log(`Schema applied: ${batches.length} batches executed successfully.`);
  } catch (err) {
    console.error('Schema run failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.close();
  }
}

run();
