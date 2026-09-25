import { ValidationPipe } from '@nestjs/common';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { StatisticalSpacesRepository } from '../dist/statistical-spaces/statistical-spaces.repository.js';
import { StatisticalSpacesService } from '../dist/statistical-spaces/statistical-spaces.service.js';
import { CreateSpaceDto } from '../dist/statistical-spaces/statistical-spaces.dto.js';
import { UsersService } from '../dist/users/users.service.js';
import { createUsersTestContext } from './support/users-test-context.mjs';

const alice = {
  issuer: 'https://issuer.example.test',
  subject: 'alice',
  email: 'alice@example.test',
};
const bob = { ...alice, subject: 'bob' };

async function withServices(run) {
  const context = await createUsersTestContext();
  try {
    const users = new UsersService(context.repository);
    const spacesRepository = new StatisticalSpacesRepository({
      getClient: () => context.client,
    });
    await run({
      users,
      spacesRepository,
      spaces: new StatisticalSpacesService(users, spacesRepository),
      client: context.client,
    });
  } finally {
    await context.close();
  }
}

test('el esquema de espacios se migra y referencia a app_users', async () => {
  await withServices(async ({ client }) => {
    const foreignKeys = await client.execute(
      'PRAGMA foreign_key_list(statistical_spaces)',
    );
    assert.equal(foreignKeys.rows[0].table, 'app_users');
    const index = await client.execute('PRAGMA index_list(statistical_spaces)');
    assert.ok(
      index.rows.some(
        (row) => row.name === 'idx_statistical_spaces_owner_created',
      ),
    );
    await assert.rejects(
      client.execute({
        sql: `INSERT INTO statistical_spaces (id, name, owner_id, created_at)
          VALUES (?, ?, ?, ?)`,
        args: [
          'orphan',
          'Huérfano',
          'missing-user',
          '2026-09-23T00:00:00.000Z',
        ],
      }),
    );
  });
});

test('cada usuario solo crea y lista sus espacios persistidos', async () => {
  await withServices(async ({ users, spaces, spacesRepository, client }) => {
    const aliceUser = await users.provision(alice);
    await users.provision(bob);

    const aliceSpace = await spaces.create(alice, { name: 'Encuesta A' });
    const bobSpace = await spaces.create(bob, { name: 'Encuesta B' });
    assert.deepEqual(await spaces.findAll(alice), [aliceSpace]);
    assert.deepEqual(await spaces.findAll(bob), [bobSpace]);
    assert.notEqual(aliceSpace.id, bobSpace.id);

    const stored = await client.execute({
      sql: 'SELECT owner_id FROM statistical_spaces WHERE id = ?',
      args: [aliceSpace.id],
    });
    assert.equal(stored.rows[0].owner_id, aliceUser.id);

    const restartedService = new StatisticalSpacesService(
      users,
      spacesRepository,
    );
    assert.deepEqual(await restartedService.findAll(alice), [aliceSpace]);
  });
});

test('sin perfil local no se puede crear ni listar espacios', async () => {
  await withServices(async ({ spaces, client }) => {
    await assert.rejects(spaces.findAll(alice), { status: 404 });
    await assert.rejects(spaces.create(alice, { name: 'Sin dueño' }), {
      status: 404,
    });
    const count = await client.execute(
      'SELECT COUNT(*) AS total FROM statistical_spaces',
    );
    assert.equal(count.rows[0].total, 0);
  });
});

test('el DTO valida el nombre y rechaza un ownerId del cliente', async () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const metadata = { type: 'body', metatype: CreateSpaceDto };
  const transformed = await pipe.transform(
    { name: '  Mi espacio  ' },
    metadata,
  );
  assert.equal(transformed.name, 'Mi espacio');

  for (const body of [
    { name: '' },
    { name: ' ' },
    { name: 'x'.repeat(121) },
    { name: 1 },
    { name: 'Válido', ownerId: 'otro' },
    {},
  ]) {
    await assert.rejects(pipe.transform(body, metadata), { status: 400 });
  }
});
