import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { DescopeSessionGuard } from './descope-session.guard.js';
import { DescopeService } from './descope.service.js';

@Module({
  controllers: [AuthController],
  providers: [DescopeService, DescopeSessionGuard],
  exports: [DescopeService, DescopeSessionGuard],
})
export class AuthModule {}
