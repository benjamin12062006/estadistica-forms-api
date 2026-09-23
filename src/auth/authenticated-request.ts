import type { Request } from 'express';

export type AuthenticatedIdentity = Readonly<{
  subject: string;
  issuer: string;
  email?: string;
}>;

export type AuthenticatedRequest = Request & {
  authenticatedIdentity?: AuthenticatedIdentity;
};
