import type { ConfigService } from '@nestjs/config';

export type DatabaseConnection = Readonly<{
  url: string;
  authToken?: string;
}>;

export function resolveDatabaseConnection(
  configService: Pick<ConfigService, 'get'>,
): DatabaseConnection {
  const url =
    configService.get<string>('DATABASE_URL')?.trim() ||
    configService.get<string>('TURSO_DATABASE_URL')?.trim();
    // 'file:./.data/estadistica-dev.db';
  const authToken = configService.get<string>('TURSO_AUTH_TOKEN')?.trim();

  if (!url) {
    throw new Error(
      'Falta DATABASE_URL (o TURSO_DATABASE_URL durante la transición).',
    );
  }

  if (url.startsWith('file:')) {
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
