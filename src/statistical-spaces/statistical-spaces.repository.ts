import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';

export type StatisticalSpace = Readonly<{
  id: string;
  name: string;
  createdAt: string;
}>;

type StatisticalSpaceRow = Readonly<{
  id: string;
  name: string;
  createdAt: string;
}>;

@Injectable()
export class StatisticalSpacesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByOwner(ownerId: string): Promise<StatisticalSpace[]> {
    const rows = await this.prisma.$queryRaw<StatisticalSpaceRow[]>(Prisma.sql`
      SELECT id, name, created_at AS createdAt
        FROM statistical_spaces
        WHERE owner_id = ${ownerId}
        ORDER BY created_at DESC, id DESC
    `);

    return rows.map((row) => this.toStatisticalSpace(row));
  }

  async create(ownerId: string, name: string): Promise<StatisticalSpace> {
    const rows = await this.prisma.$queryRaw<StatisticalSpaceRow[]>(Prisma.sql`
      INSERT INTO statistical_spaces (id, name, owner_id, created_at)
        SELECT ${randomUUID()}, ${name}, id, ${new Date().toISOString()}
        FROM app_users
        WHERE id = ${ownerId}
        RETURNING id, name, created_at AS createdAt
    `);

    const row = rows[0];
    if (!row) {
      throw new NotFoundException('El usuario propietario ya no existe.');
    }

    return this.toStatisticalSpace(row);
  }

  private toStatisticalSpace(row: StatisticalSpaceRow): StatisticalSpace {
    return { id: row.id, name: row.name, createdAt: row.createdAt };
  }
}
