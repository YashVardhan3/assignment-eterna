// Test with the simplest possible connection
const { Client } = require('pg');

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'dex_orders',
});


console.log('Attempting connection with pg.Client...');
console.log('Config:', {
  host: client.host,
  port: client.port,
  user: client.user,
  database: client.database,
});

client.connect((err) => {
  if (err) {
    console.error('✗ Connection error:', err.message);
    console.error('  Stack:', err.stack);
    process.exit(1);
  }
  console.log('✓ Connected successfully!');
  
  client.query('SELECT version()', (err, result) => {
    if (err) {
      console.error('Query error:', err);
    } else {
      console.log('PostgreSQL version:', result.rows[0].version);
    }
    client.end();
  });
});
