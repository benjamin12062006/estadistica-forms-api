import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedIdentity } from '../auth/authenticated-request.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';

export type LocalUser = Readonly<{
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
}>;

type UserProjection = Readonly<{
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
}>;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async provision(identity: AuthenticatedIdentity): Promise<LocalUser> {
    const now = new Date().toISOString();
    const rows = await this.prisma.$queryRaw<UserProjection[]>(Prisma.sql`
      INSERT INTO app_users
        (id, identity_issuer, identity_subject, email, display_name, created_at, updated_at)
        VALUES (
          ${randomUUID()},
          ${identity.issuer},
          ${identity.subject},
          ${identity.email ?? null},
          NULL,
          ${now},
          ${now}
        )
        ON CONFLICT(identity_issuer, identity_subject) DO UPDATE SET
          email = COALESCE(excluded.email, app_users.email),
          updated_at = CASE
            WHEN excluded.email IS NOT NULL AND excluded.email IS NOT app_users.email
            THEN excluded.updated_at
            ELSE app_users.updated_at
          END
        RETURNING
          id,
          email,
          display_name AS displayName,
          created_at AS createdAt,
          updated_at AS updatedAt
    `);

    const row = rows[0];
    if (!row) {
      throw new InternalServerErrorException(
        'No se pudo recuperar el usuario local.',
      );
    }

    return this.toLocalUser(row);
  }

  async findByIdentity(
    identity: AuthenticatedIdentity,
  ): Promise<LocalUser | null> {
    const user = await this.prisma.appUser.findUnique({
      where: {
        identityIssuer_identitySubject: {
          identityIssuer: identity.issuer,
          identitySubject: identity.subject,
        },
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user ? this.toLocalUser(user) : null;
  }

  async updateDisplayName(
    identity: AuthenticatedIdentity,
    displayName: string | null,
  ): Promise<LocalUser | null> {
    const existing = await this.prisma.appUser.findUnique({
      where: {
        identityIssuer_identitySubject: {
          identityIssuer: identity.issuer,
          identitySubject: identity.subject,
        },
      },
    });

    if (!existing || existing.displayName === displayName) {
      return existing ? this.toLocalUser(existing) : null;
    }

    const updated = await this.prisma.appUser.update({
      where: {
        identityIssuer_identitySubject: {
          identityIssuer: identity.issuer,
          identitySubject: identity.subject,
        },
      },
      data: {
        displayName,
        updatedAt: new Date().toISOString(),
      },
    });

    return this.toLocalUser(updated);
  }

  private toLocalUser(row: UserProjection): LocalUser {
    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
