// SQL Server (mssql) connection layer.
//
// The rest of the app (routes/*.js) was written against the mysql2/promise
// API shape: pool.query(sql, params) -> [rows] or [{insertId, affectedRows}],
// and pool.getConnection() -> conn with .beginTransaction()/.query()/.commit()/
// .rollback()/.release(). This module implements that same shape on top of
// the `mssql` driver so the route files did not need to be rewritten.
//
// Query text still uses '?' placeholders (mysql style) — they're translated
// to SQL Server's @p0, @p1... named parameters automatically.

require('dotenv').config();
const sql = require('mssql');

const config = {
  server: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_NAME || 'simple_erp',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false, // set to true if connecting to Azure SQL
    trustServerCertificate: true,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then((p) => {
    console.log('Connected to SQL Server.');
    return p;
  })
  .catch((err) => {
    console.error('SQL Server connection failed:', err.message);
    throw err;
  });

// Replace '?' placeholders with @p0, @p1... in order, matching mysql2 style.
function toNamedQuery(text) {
  let i = 0;
  return text.replace(/\?/g, () => '@p' + i++);
}

async function runQuery(request, text, params = []) {
  const namedText = toNamedQuery(text);
  params.forEach((val, idx) => {
    request.input('p' + idx, val === undefined ? null : val);
  });

  const trimmed = text.trim().toUpperCase();

  if (trimmed.startsWith('INSERT')) {
    // Append SCOPE_IDENTITY() so we can return result.insertId like mysql2 does.
    const result = await request.query(namedText + '; SELECT SCOPE_IDENTITY() AS insertId;');
    const idRow = result.recordset && result.recordset[0];
    const insertId = idRow && idRow.insertId != null ? Number(idRow.insertId) : null;
    return [{ insertId, affectedRows: result.rowsAffected[0] || 0 }];
  }

  if (trimmed.startsWith('UPDATE') || trimmed.startsWith('DELETE')) {
    const result = await request.query(namedText);
    const affectedRows = result.rowsAffected.reduce((a, b) => a + b, 0);
    return [{ affectedRows }];
  }

  // SELECT, and conditional blocks (IF NOT EXISTS ... INSERT) used by seed.js
  const result = await request.query(namedText);
  return [result.recordset || []];
}

const pool = {
  async query(text, params = []) {
    const p = await poolPromise;
    const request = p.request();
    return runQuery(request, text, params);
  },

  async getConnection() {
    const p = await poolPromise;
    const transaction = new sql.Transaction(p);
    await transaction.begin();
    let open = true;

    return {
      // Transaction is already begun above; kept for API compatibility
      // with the mysql2-style call sites (`await conn.beginTransaction()`).
      async beginTransaction() {},

      async query(text, params = []) {
        const request = new sql.Request(transaction);
        return runQuery(request, text, params);
      },

      async commit() {
        if (open) {
          await transaction.commit();
          open = false;
        }
      },

      async rollback() {
        if (open) {
          await transaction.rollback();
          open = false;
        }
      },

      release() {
        // mssql manages pooled connections internally; nothing to release.
      },
    };
  },
};

module.exports = pool;
