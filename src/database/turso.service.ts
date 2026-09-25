import { createClient, type Client } from '@libsql/client';
import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveDatabaseConnection } from './database-connection.js';

@Injectable()
export class TursoService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Client;

  constructor(configService: ConfigService) {
    this.client = createClient(resolveDatabaseConnection(configService));
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.execute('SELECT 1 AS connected');
    } catch {
      throw new Error(
        'No se pudo conectar con SQLite/libSQL. Revisa la URL y el token.',
      );
    }
  }

  onModuleDestroy(): void {
    this.client.close();
  }

  getClient(): Client {
    return this.client;
  }
}
