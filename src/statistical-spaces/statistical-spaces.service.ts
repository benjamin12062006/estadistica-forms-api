import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export type StatisticalSpace = {
  id: string;
  name: string;
  createdAt: string;
};

@Injectable()
export class StatisticalSpacesService {
  private readonly spaces: StatisticalSpace[] = [];

  findAll(): readonly StatisticalSpace[] {
    return this.spaces;
  }

  create(input: unknown): StatisticalSpace {
    const name = this.readName(input);
    const space: StatisticalSpace = {
      id: randomUUID(),
      name,
      createdAt: new Date().toISOString(),
    };

    this.spaces.push(space);
    return space;
  }

  private readName(input: unknown): string {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      throw new BadRequestException('El cuerpo debe ser un objeto JSON.');
    }

    const { name } = input as Record<string, unknown>;
    if (typeof name !== 'string') {
      throw new BadRequestException('El nombre del espacio es obligatorio.');
    }

    const normalizedName = name.trim();
    if (normalizedName.length === 0 || normalizedName.length > 120) {
      throw new BadRequestException(
        'El nombre del espacio debe tener entre 1 y 120 caracteres.',
      );
    }

    return normalizedName;
  }
}
