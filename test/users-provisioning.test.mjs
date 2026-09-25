import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withUsersRepository as withRepository } from './support/users-test-context.mjs';

const identity = {
  issuer: 'https://issuer.example.test',
  subject: 'descope-user-1',
  email: 'alice@example.test',
};

test('repetir el aprovisionamiento devuelve el mismo usuario sin modificarlo', async () => {
  await withRepository(async (repository, prisma) => {
    const first = await repository.provision(identity);
    const second = await repository.provision(identity);
    assert.deepEqual(second, first);

    assert.equal(await prisma.appUser.count(), 1);
  });
});

test('el email de una sesión validada puede cambiar sin reemplazar la identidad local', async () => {
  await withRepository(async (repository) => {
    const first = await repository.provision(identity);
    const changed = await repository.provision({
      ...identity,
      email: 'alice.new@example.test',
    });
    assert.equal(changed.id, first.id);
    assert.equal(changed.createdAt, first.createdAt);
    assert.equal(changed.email, 'alice.new@example.test');

    const withoutEmail = await repository.provision({
      issuer: identity.issuer,
      subject: identity.subject,
    });
    assert.deepEqual(withoutEmail, changed);
  });
});

test('issuer y subject forman la identidad; compartir email no fusiona usuarios', async () => {
  await withRepository(async (repository, prisma) => {
    const first = await repository.provision(identity);
    const otherSubject = await repository.provision({
      ...identity,
      subject: 'descope-user-2',
    });
    const otherIssuer = await repository.provision({
      ...identity,
      issuer: 'https://other.example.test',
    });
    assert.equal(new Set([first.id, otherSubject.id, otherIssuer.id]).size, 3);

    assert.equal(await prisma.appUser.count(), 3);
  });
});

test('peticiones concurrentes de una identidad terminan en una sola fila', async () => {
  await withRepository(async (repository, prisma) => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () => repository.provision(identity)),
    );
    assert.equal(new Set(results.map((user) => user.id)).size, 1);

    assert.equal(await prisma.appUser.count(), 1);
  });
});
