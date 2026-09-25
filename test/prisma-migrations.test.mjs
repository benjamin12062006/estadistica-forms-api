import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createUsersTestContext } from './support/users-test-context.mjs';

test('Prisma despliega las tres migraciones equivalentes en una base nueva', async () => {
  const context = await createUsersTestContext();
  try {
    const migrations = await context.prisma.$queryRaw`
      SELECT migration_name, finished_at, rolled_back_at
      FROM _prisma_migrations
      ORDER BY migration_name
    `;

    assert.deepEqual(
      migrations.map((migration) => migration.migration_name),
      [
        '20260924000100_create_app_users',
        '20260924000200_create_statistical_spaces',
        '20260924000300_index_statistical_spaces_owner',
      ],
    );
    assert.ok(migrations.every((migration) => migration.finished_at));
    assert.ok(
      migrations.every((migration) => migration.rolled_back_at === null),
    );

    const tables = await context.prisma.$queryRaw`
      SELECT name FROM sqlite_master
      WHERE type = 'table'
      ORDER BY name
    `;
    assert.ok(tables.some((table) => table.name === 'app_users'));
    assert.ok(tables.some((table) => table.name === 'statistical_spaces'));
  } finally {
    await context.close();
  }
});
