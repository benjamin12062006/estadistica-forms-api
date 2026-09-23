import { Injectable } from '@nestjs/common';
import DescopeClient, { type AuthenticationInfo } from '@descope/node-sdk';

@Injectable()
export class DescopeService {
  private readonly projectId: string;
  private readonly client: ReturnType<typeof DescopeClient>;

  constructor() {
    const projectId = process.env.DESCOPE_PROJECT_ID?.trim();
    if (!projectId) {
      throw new Error(
        'Falta DESCOPE_PROJECT_ID. Configura el Project ID de Descope en el entorno.',
      );
    }

    this.projectId = projectId;
    this.client = DescopeClient({ projectId });
  }

  validateSession(sessionToken: string): Promise<AuthenticationInfo> {
    return this.client.validateSession(sessionToken, {
      audience: this.projectId,
    });
  }
}
