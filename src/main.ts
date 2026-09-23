import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { loadEnvFile } from 'node:process';
import { AppModule } from './app.module.js';

function loadLocalEnvironment() {
  try {
    loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableCors({
    origin: [
      'http://localhost:4321',
      'http://127.0.0.1:4321',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Authorization', 'Content-Type'],
  });

  await app.listen(process.env.PORT ?? 8080, '127.0.0.1');
}

loadLocalEnvironment();
await bootstrap();
