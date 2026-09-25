import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TursoService } from '../database/turso.service.js';

export type StatisticalSpace = Readonly<{
  id: string;
  name: string;
  createdAt: string;
}>;

@Injectable()
export class StatisticalSpacesRepository {
  constructor(private readonly tursoService: TursoService) {}

  async findAllByOwner(ownerId: string): Promise<StatisticalSpace[]> {
    const result = await this.tursoService.getClient().execute({
      sql: `SELECT id, name, created_at
        FROM statistical_spaces
        WHERE owner_id = ?
        ORDER BY created_at DESC, id DESC`,
      args: [ownerId],
    });

    return result.rows.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      createdAt: row.created_at as string,
    }));
  }

  async create(ownerId: string, name: string): Promise<StatisticalSpace> {
    const result = await this.tursoService.getClient().execute({
      sql: `INSERT INTO statistical_spaces (id, name, owner_id, created_at)
        SELECT ?, ?, id, ? FROM app_users WHERE id = ?
        RETURNING id, name, created_at`,
      args: [randomUUID(), name, new Date().toISOString(), ownerId],
    });

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('El usuario propietario ya no existe.');
    }

    return {
      id: row.id as string,
      name: row.name as string,
      createdAt: row.created_at as string,
    };
  }
}
