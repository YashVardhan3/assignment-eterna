import { database } from './index';

async function migrate() {
  try {
    console.log('Running database migrations...');
    await database.initialize();
    console.log('Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
