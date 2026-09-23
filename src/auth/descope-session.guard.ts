import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './authenticated-request.js';
import { DescopeService } from './descope.service.js';

@Injectable()
export class DescopeSessionGuard implements CanActivate {
  constructor(private readonly descopeService: DescopeService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionToken = this.readBearerToken(request.headers.authorization);

    try {
      const { token } = await this.descopeService.validateSession(sessionToken);
      const subject = this.readRequiredClaim(token.sub);
      const issuer = this.readRequiredClaim(token.iss);
      const email = this.readOptionalClaim(token.email);

      request.authenticatedIdentity = Object.freeze({
        subject,
        issuer,
        ...(email ? { email } : {}),
      });

      return true;
    } catch {
      throw new UnauthorizedException('Sesión inválida o expirada.');
    }
  }

  private readBearerToken(authorization: string | undefined): string {
    const match = authorization?.match(/^Bearer ([^\s]+)$/i);
    if (!match) {
      throw new UnauthorizedException(
        'Se requiere Authorization: Bearer <sessionJwt>.',
      );
    }

    return match[1];
  }

  private readRequiredClaim(value: unknown): string {
    if (typeof value !== 'string' || value.length === 0) {
      throw new UnauthorizedException(
        'La sesión no contiene una identidad válida.',
      );
    }

    return value;
  }

  private readOptionalClaim(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }
}
