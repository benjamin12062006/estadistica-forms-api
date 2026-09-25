import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TursoModule } from '../database/turso.module.js';
import { UsersModule } from '../users/users.module.js';
import { StatisticalSpacesController } from './statistical-spaces.controller.js';
import { StatisticalSpacesRepository } from './statistical-spaces.repository.js';
import { StatisticalSpacesService } from './statistical-spaces.service.js';

@Module({
  imports: [AuthModule, TursoModule, UsersModule],
  controllers: [StatisticalSpacesController],
  providers: [StatisticalSpacesService, StatisticalSpacesRepository],
})
export class StatisticalSpacesModule {}
