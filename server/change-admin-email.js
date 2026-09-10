require('dotenv').config();
const { pool, initDatabase } = require('./db');

const looksLikeEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const USAGE = `Usage:
  node server/change-admin-email.js <newEmail>                     (only works when there is exactly one admin)
  node server/change-admin-email.js <currentEmail> <newEmail>

Requires DATABASE_URL (and DATABASE_SSL=true for Neon/managed Postgres) in the environment or .env.`;

(async () => {
  try {
    const args = process.argv.slice(2).filter(Boolean);
    if (args.length < 1 || args.length > 2) throw new Error(USAGE);

    const newEmail = args[args.length - 1];
    const currentEmail = args.length === 2 ? args[0] : null;
    if (!looksLikeEmail(newEmail)) throw new Error(`"${newEmail}" is not a valid email.\n\n${USAGE}`);

    await initDatabase();

    let targetCurrent = currentEmail;
    if (!targetCurrent) {
      const admins = await pool.query('SELECT email FROM admins ORDER BY id');
      if (admins.rows.length === 0) throw new Error('No admin accounts exist. Run: npm run create-admin');
      if (admins.rows.length > 1) {
        throw new Error(
          `There are ${admins.rows.length} admins (${admins.rows.map((r) => r.email).join(', ')}). ` +
          'Pass the current email explicitly: node server/change-admin-email.js <currentEmail> <newEmail>'
        );
      }
      targetCurrent = admins.rows[0].email;
    }

    const clash = await pool.query(
      'SELECT id FROM admins WHERE LOWER(email) = LOWER($1) AND LOWER(email) <> LOWER($2)',
      [newEmail, targetCurrent]
    );
    if (clash.rows[0]) throw new Error(`Another admin already uses ${newEmail}.`);

    const result = await pool.query(
      'UPDATE admins SET email = $1 WHERE LOWER(email) = LOWER($2) RETURNING id, email',
      [newEmail, targetCurrent]
    );
    if (!result.rows[0]) throw new Error(`No admin found with the email ${targetCurrent}.`);

    console.log(`Admin email updated: ${result.rows[0].email}`);
    console.log('Password is unchanged. Sign in with the new email next time (any active session stays valid until it expires).');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
