import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { StatisticalSpacesModule } from './statistical-spaces/statistical-spaces.module.js';

@Module({
  imports: [AuthModule, StatisticalSpacesModule],
})
export class AppModule {}
