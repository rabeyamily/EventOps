import { sequelize } from './connection';

const syncDatabase = async (force: boolean = false) => {
  try {
    console.log('🔄 Starting database migration...');
    
    // Sync all models in order (respecting foreign key dependencies)
    await sequelize.sync({ force, alter: !force });
    
    console.log('✅ Database migration completed successfully.');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    throw error;
  }
};

// Run migration if called directly
if (require.main === module) {
  const force = process.argv.includes('--force');
  syncDatabase(force)
    .then(() => {
      console.log('Migration complete. Exiting...');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { syncDatabase };

