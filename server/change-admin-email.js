require('dotenv').config();
const readline = require('readline');
const { pool, initDatabase } = require('./db');

const ask = (question) => new Promise((resolve) => {
  const input = readline.createInterface({ input: process.stdin, output: process.stdout });
  input.question(question, (answer) => { input.close(); resolve(answer.trim()); });
});

const looksLikeEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

(async () => {
  try {
    await initDatabase();
    const currentEmail = await ask('Current admin email: ');
    const newEmail = await ask('New admin email: ');
    if (!currentEmail || !looksLikeEmail(newEmail)) {
      throw new Error('A valid current email and a valid new email are required.');
    }

    const clash = await pool.query(
      'SELECT id FROM admins WHERE LOWER(email) = LOWER($1) AND LOWER(email) <> LOWER($2)',
      [newEmail, currentEmail]
    );
    if (clash.rows[0]) throw new Error(`Another admin already uses ${newEmail}.`);

    const result = await pool.query(
      'UPDATE admins SET email = $1 WHERE LOWER(email) = LOWER($2) RETURNING id, email',
      [newEmail, currentEmail]
    );
    if (!result.rows[0]) throw new Error(`No admin found with the email ${currentEmail}.`);

    console.log(`Admin email updated: ${result.rows[0].email}`);
    console.log('The password is unchanged. Any active admin session stays valid until it expires (12h) — sign in with the new email next time.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
