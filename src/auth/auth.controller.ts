import {
  Controller,
  Get,
  InternalServerErrorException,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './authenticated-request.js';
import { DescopeSessionGuard } from './descope-session.guard.js';

@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(DescopeSessionGuard)
  getCurrentIdentity(@Req() request: AuthenticatedRequest) {
    if (!request.authenticatedIdentity) {
      throw new InternalServerErrorException(
        'No se pudo recuperar la identidad autenticada.',
      );
    }

    return { identity: request.authenticatedIdentity };
  }
}
