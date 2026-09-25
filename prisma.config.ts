import { loadEnvFile } from 'node:process';
import { defineConfig } from 'prisma/config';

try {
  loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

const databaseUrl =
  process.env.DATABASE_URL?.trim() ||
  process.env.TURSO_DATABASE_URL?.trim() ||
  'file:./.data/estadistica-dev.db';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
});
