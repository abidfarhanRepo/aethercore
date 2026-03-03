const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function dropHealthCheckTable() {
  try {
    console.log('Attempting to drop health_check table...');
    await pool.query('DROP TABLE IF EXISTS "health_check";');
    console.log('✅ health_check table dropped (if it existed)');
  } catch (error) {
    console.error('⚠️  Error dropping health_check table:', error.message);
  } finally {
    await pool.end();
  }
}

dropHealthCheckTable();
