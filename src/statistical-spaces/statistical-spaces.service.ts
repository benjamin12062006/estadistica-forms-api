import { Injectable } from '@nestjs/common';
import type { AuthenticatedIdentity } from '../auth/authenticated-request.js';
import { UsersService } from '../users/users.service.js';
import { StatisticalSpacesRepository } from './statistical-spaces.repository.js';
import type { CreateSpaceDto } from './statistical-spaces.dto.js';

@Injectable()
export class StatisticalSpacesService {
  constructor(
    private readonly usersService: UsersService,
    private readonly spacesRepository: StatisticalSpacesRepository,
  ) {}

  async findAll(identity: AuthenticatedIdentity) {
    const owner = await this.usersService.findCurrent(identity);
    return this.spacesRepository.findAllByOwner(owner.id);
  }

  async create(identity: AuthenticatedIdentity, input: CreateSpaceDto) {
    const owner = await this.usersService.findCurrent(identity);
    return this.spacesRepository.create(owner.id, input.name);
  }
}
