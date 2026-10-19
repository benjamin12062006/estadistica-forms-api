import { PrismaLibSql } from '@prisma/adapter-libsql';
import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../generated/prisma/client.js';
import { resolveDatabaseConnection } from './database-connection.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  
  constructor(configService: ConfigService) {
    const connection = resolveDatabaseConnection(configService);
    const adapter = new PrismaLibSql(connection);
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
  
}
