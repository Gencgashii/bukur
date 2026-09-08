'use strict';
require('dotenv').config();
const { Client } = require('pg');

// Creates the application database named in DATABASE_URL (default: "bukur").
// Connects to the maintenance "postgres" database to issue CREATE DATABASE.
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const url = new URL(process.env.DATABASE_URL);
const dbName = decodeURIComponent((url.pathname || '/bukur').replace(/^\//, '')) || 'bukur';
url.pathname = '/postgres';

const client = new Client({ connectionString: url.toString() });

client
  .connect()
  .then(() => client.query(`CREATE DATABASE "${dbName.replace(/"/g, '')}"`))
  .then(() => console.log('DATABASE_CREATED:', dbName))
  .catch((error) => {
    if (error.code === '42P04') console.log('DATABASE_ALREADY_EXISTS:', dbName);
    else {
      console.error(error.message);
      process.exitCode = 1;
    }
  })
  .finally(() => client.end());
