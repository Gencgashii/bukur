'use strict';

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Optional TLS for the DB connection. Many managed Postgres providers (incl.
// Render's external URL) require SSL. Opt in via DATABASE_SSL:
//   'true'   -> TLS, do not verify the server cert (common for managed PG)
//   'strict' -> TLS, verify the server cert
//   unset    -> no SSL option (local dev / provider that negotiates it itself)
const sslOption =
  process.env.DATABASE_SSL === 'strict'
    ? { rejectUnauthorized: true }
    : process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: false }
      : undefined;

const databaseConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ...(sslOption ? { ssl: sslOption } : {}) }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'bukur',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      ...(sslOption ? { ssl: sslOption } : {}),
    };

if (!databaseConfig.password && !process.env.DATABASE_URL) {
  throw new Error('Add DB_PASSWORD or DATABASE_URL to the root .env file.');
}

const pool = new Pool(databaseConfig);

// Surface pool-level failures instead of crashing the process silently.
pool.on('error', (err) => {
  console.error('[db] unexpected idle client error:', err.message);
});

const initDatabase = async () => {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
};

/**
 * Run `fn` inside a single transaction. Commits on success, rolls back on any
 * throw, always releases the client. `fn` receives the connected client.
 */
const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('[db] rollback failed:', rollbackError.message);
    }
    throw error;
  } finally {
    client.release();
  }
};

const query = (text, params) => pool.query(text, params);

module.exports = { pool, query, withTransaction, initDatabase };
