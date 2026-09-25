import { createClient } from '@libsql/client';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  applyPrismaMigrationsToTurso,
  getPrismaTursoMigrationStatus,
} from '../scripts/db/migrate-prisma-to-turso.mjs';

test('el ejecutor Turso aplica prisma/migrations y es repetible', async () => {
  const client = createClient({ url: ':memory:' });
  try {
    await applyPrismaMigrationsToTurso(client);
    await applyPrismaMigrationsToTurso(client);

    const status = await getPrismaTursoMigrationStatus(client);
    assert.deepEqual(
      status.map((migration) => migration.status),
      ['applied', 'applied', 'applied'],
    );

    const tables = await client.execute(
      `SELECT name FROM sqlite_master
       WHERE type = 'table'
       ORDER BY name`,
    );
    assert.ok(tables.rows.some((row) => row.name === 'app_users'));
    assert.ok(tables.rows.some((row) => row.name === 'statistical_spaces'));
  } finally {
    client.close();
  }
});

test('el ejecutor registra como baseline las migraciones SQL ya aplicadas', async () => {
  const client = createClient({ url: ':memory:' });
  try {
    await client.execute(`
      CREATE TABLE schema_migrations (
        version TEXT PRIMARY KEY NOT NULL,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    for (const version of [
      '001_create_app_users.sql',
      '002_create_statistical_spaces.sql',
      '003_index_statistical_spaces_owner.sql',
    ]) {
      await client.execute({
        sql: 'INSERT INTO schema_migrations (version) VALUES (?)',
        args: [version],
      });
    }

    await applyPrismaMigrationsToTurso(client);

    const status = await getPrismaTursoMigrationStatus(client);
    assert.deepEqual(
      status.map((migration) => migration.status),
      ['baselined', 'baselined', 'baselined'],
    );
  } finally {
    client.close();
  }
});
