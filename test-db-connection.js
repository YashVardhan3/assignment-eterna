const { Pool } = require('pg');

// Back to postgres:password on port 5433
const pool = new Pool({
  host: '127.0.0.1',
  port: 5433,
  database: 'dex_orders',
  user: 'postgres',
  password: 'password',
});


async function testConnection() {
  try {
    console.log('Testing PostgreSQL connection to 127.0.0.1:5432...');
    const client = await pool.connect();
    const result = await client.query('SELECT NOW(), version()');
    console.log('✓ Connection successful!');
    console.log('  Time:', result.rows[0].now);
    console.log('  Version:', result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1]);
    client.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('✗ Connection failed:', error.message);
    console.error('  Code:', error.code);
    await pool.end();
    process.exit(1);
  }
}

testConnection();
