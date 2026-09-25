import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { PrismaService } from '../../dist/database/prisma.service.js';
import { UsersRepository } from '../../dist/users/users.repository.js';

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const prismaCli = join(projectRoot, 'node_modules', '.bin', 'prisma');

export async function createUsersTestContext() {
  const directory = await mkdtemp(join(tmpdir(), 'estadistica-users-'));
  const databasePath = join(directory, 'test.db');
  const databaseUrl = `file:${databasePath}`;
  await writeFile(databasePath, '');
  await execFileAsync(prismaCli, ['migrate', 'deploy'], {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  const prisma = new PrismaService({
    get(key) {
      return key === 'DATABASE_URL' ? databaseUrl : undefined;
    },
  });

  await prisma.onModuleInit();

  return {
    prisma,
    repository: new UsersRepository(prisma),
    async close() {
      await prisma.onModuleDestroy();
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
