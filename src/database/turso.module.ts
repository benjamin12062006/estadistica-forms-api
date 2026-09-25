import { Module } from '@nestjs/common';
import { TursoService } from './turso.service.js';

@Module({
  providers: [TursoService],
  exports: [TursoService],
})
export class TursoModule {}
