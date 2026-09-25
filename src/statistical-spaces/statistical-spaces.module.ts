import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { UsersModule } from '../users/users.module.js';
import { StatisticalSpacesController } from './statistical-spaces.controller.js';
import { StatisticalSpacesRepository } from './statistical-spaces.repository.js';
import { StatisticalSpacesService } from './statistical-spaces.service.js';

@Module({
  imports: [AuthModule, PrismaModule, UsersModule],
  controllers: [StatisticalSpacesController],
  providers: [StatisticalSpacesService, StatisticalSpacesRepository],
})
export class StatisticalSpacesModule {}
