import { createClient } from '@libsql/client';
import { applyMigrations } from './migrate.mjs';

const client = createClient({ url: ':memory:' });

try {
  await applyMigrations(client);
  await applyMigrations(client);

  const row = {
    id: 'usuario-prueba',
    issuer: 'https://example.test/issuer',
    subject: 'subject-prueba',
    createdAt: '2026-09-23T00:00:00.000Z',
  };
  await client.execute({
    sql: `INSERT INTO app_users
      (id, identity_issuer, identity_subject, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)`,
    args: [row.id, row.issuer, row.subject, row.createdAt, row.createdAt],
  });

  const found = await client.execute({
    sql: `SELECT id FROM app_users
      WHERE identity_issuer = ? AND identity_subject = ?`,
    args: [row.issuer, row.subject],
  });
  if (found.rows.length !== 1 || found.rows[0].id !== row.id) {
    throw new Error('No se pudo recuperar el usuario de prueba.');
  }

  let duplicateRejected = false;
  try {
    await client.execute({
      sql: `INSERT INTO app_users
        (id, identity_issuer, identity_subject, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)`,
      args: ['otro-id', row.issuer, row.subject, row.createdAt, row.createdAt],
    });
  } catch {
    duplicateRejected = true;
  }
  if (!duplicateRejected) {
    throw new Error('La restricción única no rechazó la identidad duplicada.');
  }

  console.log('OK: migración repetible, inserción, lectura e identidad única.');
} finally {
  client.close();
}
