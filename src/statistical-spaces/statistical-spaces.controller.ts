import { Body, Controller, Get, Post } from '@nestjs/common';
import { StatisticalSpacesService } from './statistical-spaces.service.js';

@Controller('statistical-spaces')
export class StatisticalSpacesController {
  constructor(
    private readonly statisticalSpacesService: StatisticalSpacesService,
  ) {}

  @Get()
  findAll() {
    return this.statisticalSpacesService.findAll();
  }

  @Post()
  create(@Body() body: unknown) {
    return this.statisticalSpacesService.create(body);
  }
}
