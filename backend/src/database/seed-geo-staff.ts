import { sequelize } from './connection';

export async function seedGEOStaff() {
  console.log('ℹ️  No predefined GEO staff to seed. Add staff members through the app.');
}

// Run if called directly
if (require.main === module) {
  sequelize
    .sync()
    .then(() => seedGEOStaff())
    .then(() => {
      console.log('Done.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}
