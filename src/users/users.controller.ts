import {
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Patch,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { DescopeSessionGuard } from '../auth/descope-session.guard.js';
import { UsersService } from './users.service.js';
import { UpdateProfileDto } from './users.dto.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(DescopeSessionGuard)
  async getCurrentUser(@Req() request: AuthenticatedRequest) {
    return {
      user: await this.usersService.findCurrent(this.requireIdentity(request)),
    };
  }

  @Put('me')
  @UseGuards(DescopeSessionGuard)
  async provisionCurrentUser(@Req() request: AuthenticatedRequest) {
    return {
      user: await this.usersService.provision(this.requireIdentity(request)),
    };
  }

  @Patch('me')
  @UseGuards(DescopeSessionGuard)
  async updateCurrentUser(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateProfileDto,
  ) {
    return {
      user: await this.usersService.updateCurrent(
        this.requireIdentity(request),
        body,
      ),
    };
  }

  private requireIdentity(request: AuthenticatedRequest) {
    if (!request.authenticatedIdentity) {
      throw new InternalServerErrorException(
        'No se pudo recuperar la identidad autenticada.',
      );
    }
    return request.authenticatedIdentity;
  }
}
