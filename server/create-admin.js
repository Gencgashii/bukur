require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const { pool, initDatabase } = require('./db');

const ask = (question, hidden = false) => new Promise((resolve) => {
  const input = readline.createInterface({ input: process.stdin, output: process.stdout });
  input.question(question, (answer) => { input.close(); resolve(answer.trim()); });
});

(async () => {
  try {
    await initDatabase();
    const email = await ask('Admin email: ');
    const password = await ask('Admin password (minimum 12 characters): ');
    if (!email || password.length < 12) throw new Error('Email and a 12-character password are required.');
    await pool.query('INSERT INTO admins (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash', [email, await bcrypt.hash(password, 12)]);
    console.log(`Admin ready: ${email}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
