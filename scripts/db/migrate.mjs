import { createClient } from '@libsql/client';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

const migrationsDir = new URL('../../migrations/', import.meta.url);

export async function applyMigrations(client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const files = readdirSync(migrationsDir)
    .filter((file) => /^\d+_[a-z0-9_]+\.sql$/.test(file))
    .sort();

  for (const file of files) {
    const applied = await client.execute({
      sql: 'SELECT 1 FROM schema_migrations WHERE version = ?',
      args: [file],
    });
    if (applied.rows.length > 0) continue;

    const sql = readFileSync(new URL(file, migrationsDir), 'utf8').trim();
    await client.batch(
      [
        sql,
        {
          sql: 'INSERT INTO schema_migrations (version) VALUES (?)',
          args: [file],
        },
      ],
      'write',
    );
    console.log(`Migración aplicada: ${file}`);
  }
}

function loadLocalEnvironment() {
  try {
    loadEnvFile();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function resolveDatabaseConnection() {
  const url =
    process.env.DATABASE_URL?.trim() || process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (!url) {
    throw new Error(
      'Falta DATABASE_URL (o TURSO_DATABASE_URL durante la transición).',
    );
  }

  if (url.startsWith('file:')) {
    const localPath = url.slice('file:'.length).split('?')[0];
    if (localPath && localPath !== ':memory:') {
      mkdirSync(dirname(resolve(localPath)), { recursive: true });
    }
    return { url };
  }

  if (!url.startsWith('libsql://')) {
    throw new Error('DATABASE_URL debe usar file: o libsql://.');
  }

  if (!authToken) {
    throw new Error('TURSO_AUTH_TOKEN es obligatorio con una URL libsql://.');
  }

  return { url, authToken };
}

async function main() {
  loadLocalEnvironment();
  const client = createClient(resolveDatabaseConnection());
  try {
    await applyMigrations(client);
  } finally {
    client.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
