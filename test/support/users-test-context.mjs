import { createClient } from '@libsql/client';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyMigrations } from '../../scripts/db/migrate.mjs';
import { PrismaService } from '../../dist/database/prisma.service.js';
import { UsersRepository } from '../../dist/users/users.repository.js';

export async function createUsersTestContext() {
  const directory = await mkdtemp(join(tmpdir(), 'estadistica-users-'));
  const databaseUrl = `file:${join(directory, 'test.db')}`;
  const client = createClient({ url: databaseUrl });
  await client.execute('PRAGMA foreign_keys = ON');
  await applyMigrations(client);

  const prisma = new PrismaService({
    get(key) {
      return key === 'DATABASE_URL' ? databaseUrl : undefined;
    },
  });

  await prisma.onModuleInit();

  return {
    client,
    prisma,
    repository: new UsersRepository(prisma),
    async close() {
      await prisma.onModuleDestroy();
      client.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

export async function withUsersRepository(run) {
  const context = await createUsersTestContext();
  try {
    await run(context.repository, context.prisma);
  } finally {
    await context.close();
  }
}
