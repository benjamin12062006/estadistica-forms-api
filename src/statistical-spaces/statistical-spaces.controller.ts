import {
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { DescopeSessionGuard } from '../auth/descope-session.guard.js';
import { StatisticalSpacesService } from './statistical-spaces.service.js';
import { CreateSpaceDto } from './statistical-spaces.dto.js';

@Controller('statistical-spaces')
export class StatisticalSpacesController {
  constructor(
    private readonly statisticalSpacesService: StatisticalSpacesService,
  ) {}

  @Get()
  @UseGuards(DescopeSessionGuard)
  findAll(@Req() request: AuthenticatedRequest) {
    return this.statisticalSpacesService.findAll(this.requireIdentity(request));
  }

  @Post()
  @UseGuards(DescopeSessionGuard)
  create(@Req() request: AuthenticatedRequest, @Body() body: CreateSpaceDto) {
    return this.statisticalSpacesService.create(
      this.requireIdentity(request),
      body,
    );
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
