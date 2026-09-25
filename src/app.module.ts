import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { TursoModule } from './database/turso.module.js';
import { StatisticalSpacesModule } from './statistical-spaces/statistical-spaces.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    TursoModule,
    UsersModule,
    StatisticalSpacesModule,
  ],
})
export class AppModule {}
