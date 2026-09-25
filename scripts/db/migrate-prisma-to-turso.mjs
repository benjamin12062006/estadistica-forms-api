import { createClient } from '@libsql/client';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

const migrationsDirectory = new URL(
  '../../prisma/migrations/',
  import.meta.url,
);

const legacyVersionByPrismaMigration = new Map([
  ['20260924000100_create_app_users', '001_create_app_users.sql'],
  [
    '20260924000200_create_statistical_spaces',
    '002_create_statistical_spaces.sql',
  ],
  [
    '20260924000300_index_statistical_spaces_owner',
    '003_index_statistical_spaces_owner.sql',
  ],
]);

function readPrismaMigrations() {
  return readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && /^\d{14}_[a-z0-9_]+$/.test(entry.name),
    )
    .map((entry) => {
      const sql = readFileSync(
        new URL(`${entry.name}/migration.sql`, migrationsDirectory),
        'utf8',
      ).trim();

      return {
        name: entry.name,
        sql,
        checksum: createHash('sha256').update(sql).digest('hex'),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function tableExists(client, tableName) {
  const result = await client.execute({
    sql: `SELECT 1 FROM sqlite_master
      WHERE type = 'table' AND name = ?`,
    args: [tableName],
  });
  return result.rows.length > 0;
}

async function readAppliedMigrations(client) {
  if (!(await tableExists(client, 'prisma_remote_migrations')))
    return new Map();

  const result = await client.execute(`
    SELECT migration_name, checksum, execution_kind
    FROM prisma_remote_migrations
    ORDER BY migration_name
  `);

  return new Map(
    result.rows.map((row) => [
      row.migration_name,
      {
        checksum: row.checksum,
        executionKind: row.execution_kind,
      },
    ]),
  );
}

async function wasAppliedByLegacyMigrator(client, migrationName) {
  const legacyVersion = legacyVersionByPrismaMigration.get(migrationName);
  if (!legacyVersion || !(await tableExists(client, 'schema_migrations'))) {
    return false;
  }

  const result = await client.execute({
    sql: 'SELECT 1 FROM schema_migrations WHERE version = ?',
    args: [legacyVersion],
  });
  return result.rows.length > 0;
}

async function createTrackingTable(client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS prisma_remote_migrations (
      migration_name TEXT PRIMARY KEY NOT NULL,
      checksum TEXT NOT NULL,
      execution_kind TEXT NOT NULL CHECK (
        execution_kind IN ('applied', 'baselined')
      ),
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function registerBaseline(client, migration) {
  await client.execute({
    sql: `INSERT INTO prisma_remote_migrations
      (migration_name, checksum, execution_kind)
      VALUES (?, ?, 'baselined')`,
    args: [migration.name, migration.checksum],
  });
}

async function applyMigration(client, migration) {
  const transaction = await client.transaction('write');
  try {
    await transaction.executeMultiple(migration.sql);
    await transaction.execute({
      sql: `INSERT INTO prisma_remote_migrations
        (migration_name, checksum, execution_kind)
        VALUES (?, ?, 'applied')`,
      args: [migration.name, migration.checksum],
    });
    await transaction.commit();
  } catch (error) {
    if (!transaction.closed) await transaction.rollback();
    throw error;
  } finally {
    transaction.close();
  }
}

export async function applyPrismaMigrationsToTurso(client) {
  await createTrackingTable(client);
  const migrations = readPrismaMigrations();
  const applied = await readAppliedMigrations(client);

  for (const migration of migrations) {
    const existing = applied.get(migration.name);
    if (existing) {
      if (existing.checksum !== migration.checksum) {
        throw new Error(
          `La migración remota ${migration.name} cambió después de aplicarse.`,
        );
      }
      console.log(`Migración Turso ya registrada: ${migration.name}`);
      continue;
    }

    if (await wasAppliedByLegacyMigrator(client, migration.name)) {
      await registerBaseline(client, migration);
      console.log(`Baseline Turso registrado: ${migration.name}`);
      continue;
    }

    await applyMigration(client, migration);
    console.log(`Migración Prisma aplicada a Turso: ${migration.name}`);
  }
}

export async function getPrismaTursoMigrationStatus(client) {
  const migrations = readPrismaMigrations();
  const applied = await readAppliedMigrations(client);

  return migrations.map((migration) => {
    const existing = applied.get(migration.name);
    if (!existing) return { name: migration.name, status: 'pending' };
    if (existing.checksum !== migration.checksum) {
      return { name: migration.name, status: 'checksum-mismatch' };
    }
    return { name: migration.name, status: existing.executionKind };
  });
}

function loadLocalEnvironment() {
  try {
    loadEnvFile();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function resolveTursoConnection() {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (!url?.startsWith('libsql://')) {
    throw new Error('TURSO_DATABASE_URL debe usar libsql://.');
  }
  if (!authToken) throw new Error('Falta TURSO_AUTH_TOKEN.');

  return { url, authToken };
}

async function main() {
  loadLocalEnvironment();
  const client = createClient(resolveTursoConnection());
  try {
    if (process.argv.includes('--status')) {
      const status = await getPrismaTursoMigrationStatus(client);
      for (const migration of status) {
        console.log(`${migration.status}: ${migration.name}`);
      }
      if (
        status.some(
          (migration) =>
            migration.status !== 'applied' && migration.status !== 'baselined',
        )
      ) {
        process.exitCode = 1;
      }
      return;
    }

    await applyPrismaMigrationsToTurso(client);
  } finally {
    client.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
