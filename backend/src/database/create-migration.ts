import fs from 'fs';
import path from 'path';

const migrationsDir = path.join(__dirname, '../../migrations');

if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir, { recursive: true });
}

const migrationName = process.argv[2];

if (!migrationName) {
  console.error('❌ Please provide a migration name: npm run migrate:create <migration-name>');
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
const fileName = `${timestamp}_${migrationName}.ts`;
const filePath = path.join(migrationsDir, fileName);

const template = `import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // Add migration logic here
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  // Add rollback logic here
}
`;

fs.writeFileSync(filePath, template);
console.log(`✅ Created migration: ${fileName}`);

