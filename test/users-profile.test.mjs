import { ValidationPipe } from '@nestjs/common';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UsersService } from '../dist/users/users.service.js';
import { UpdateProfileDto } from '../dist/users/users.dto.js';
import { withUsersRepository } from './support/users-test-context.mjs';

const alice = {
  issuer: 'https://issuer.example.test',
  subject: 'alice',
  email: 'alice@example.test',
};
const bob = { ...alice, subject: 'bob' };

async function withUsers(run) {
  await withUsersRepository((repository, prisma) =>
    run(new UsersService(repository), prisma),
  );
}

test('GET lógico recupera solo el perfil correspondiente a la identidad validada', async () => {
  await withUsers(async (users) => {
    const aliceUser = await users.provision(alice);
    const bobUser = await users.provision(bob);
    assert.deepEqual(await users.findCurrent(alice), aliceUser);
    assert.deepEqual(await users.findCurrent(bob), bobUser);
    assert.notEqual(aliceUser.id, bobUser.id);
  });
});

test('leer o editar antes de aprovisionar devuelve 404 y no crea una fila', async () => {
  await withUsers(async (users, prisma) => {
    await assert.rejects(users.findCurrent(alice), { status: 404 });
    await assert.rejects(users.updateCurrent(alice, { displayName: 'Alice' }), {
      status: 404,
    });
    assert.equal(await prisma.appUser.count(), 0);
  });
});

test('PATCH solo modifica displayName y no afecta a otro usuario', async () => {
  await withUsers(async (users) => {
    const first = await users.provision(alice);
    const other = await users.provision(bob);
    const updated = await users.updateCurrent(alice, {
      displayName: 'Alice',
    });
    assert.equal(updated.id, first.id);
    assert.equal(updated.email, first.email);
    assert.equal(updated.displayName, 'Alice');
    assert.deepEqual(await users.findCurrent(bob), other);
    assert.equal((await users.provision(alice)).displayName, 'Alice');
    assert.deepEqual(
      await users.updateCurrent(alice, { displayName: 'Alice' }),
      updated,
    );

    const cleared = await users.updateCurrent(alice, { displayName: null });
    assert.equal(cleared.displayName, null);
    assert.equal(cleared.id, first.id);
  });
});

test('el DTO recorta el nombre y rechaza propiedades o valores no permitidos', async () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const metadata = { type: 'body', metatype: UpdateProfileDto };

  const transformed = await pipe.transform(
    { displayName: '  Alice  ' },
    metadata,
  );
  assert.equal(transformed.displayName, 'Alice');
  for (const input of [
    { displayName: '' },
    { displayName: ' '.repeat(3) },
    { displayName: 'A'.repeat(121) },
    { displayName: 'Alice', role: 'admin' },
    { displayName: 'Alice', identitySubject: 'bob' },
    { displayName: 'Alice', email: 'new@example.test' },
    {},
  ]) {
    await assert.rejects(pipe.transform(input, metadata), { status: 400 });
  }
});
