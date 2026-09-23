import { Module } from '@nestjs/common';
import { StatisticalSpacesController } from './statistical-spaces.controller.js';
import { StatisticalSpacesService } from './statistical-spaces.service.js';

@Module({
  controllers: [StatisticalSpacesController],
  providers: [StatisticalSpacesService],
})
export class StatisticalSpacesModule {}
