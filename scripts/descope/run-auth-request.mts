import DescopeClient, { type SdkResponse } from '@descope/node-sdk';
import { spawnSync } from 'node:child_process';
import { loadEnvFile } from 'node:process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

loadLocalEnvironment();

const projectId = requireEnvironment('DESCOPE_PROJECT_ID');
const managementKey = requireEnvironment('DESCOPE_MANAGEMENT_KEY');
const testLoginId = requireEnvironment('DESCOPE_TEST_LOGIN_ID');

const descope = DescopeClient({ projectId, managementKey });

console.log('Solicitando un OTP temporal para el usuario de prueba…');
const otp = requireResponseData(
  await descope.management.user.generateOTPForTestUser('email', testLoginId),
  'generar el OTP de prueba',
);

const authentication = requireResponseData(
  await descope.otp.verify.email(testLoginId, otp.code),
  'verificar el OTP de prueba',
);

const sessionJwt = authentication.sessionJwt;
if (!sessionJwt) {
  throw new Error(
    'Descope no devolvió un sessionJwt para el usuario de prueba.',
  );
}

const authInfo = await descope.validateSession(sessionJwt, {
  audience: projectId,
});

if (authInfo.token.tu !== true) {
  throw new Error(
    'La sesión obtenida no pertenece a un usuario de prueba (claim tu !== true).',
  );
}

console.log('Sesión de prueba validada. Ejecutando GET /api/v1/auth/me…');

const httpyacExecutable = resolve(
  projectRoot,
  'node_modules/.bin',
  process.platform === 'win32' ? 'httpyac.cmd' : 'httpyac',
);

const requestResult = spawnSync(
  httpyacExecutable,
  [
    'send',
    'requests/auth.http',
    '--name',
    'authenticated',
    '--quiet',
    '--output',
    'none',
    '--output-failed',
    'none',
  ],
  {
    cwd: projectRoot,
    env: { ...process.env, TEST_SESSION_JWT: sessionJwt },
    encoding: 'utf8',
  },
);

if (requestResult.error) {
  throw requestResult.error;
}

if (requestResult.status !== 0) {
  throw new Error(
    `httpyac terminó con código ${requestResult.status ?? 'desconocido'}. ` +
      'Confirma que la API Nest esté ejecutándose en 127.0.0.1:8080. ' +
      'La salida de httpyac se ocultó para no exponer el token.',
  );
}

console.log('Prueba autenticada completada correctamente (HTTP 2xx).');

function loadLocalEnvironment(): void {
  try {
    loadEnvFile(resolve(projectRoot, '.env'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Falta ${name}. Agrégala al archivo .env local y vuelve a ejecutar el comando.`,
    );
  }

  return value;
}

function requireResponseData<T extends Record<string, unknown>>(
  response: SdkResponse<T>,
  operation: string,
): T {
  if (!response.ok || !response.data) {
    const code = response.error?.errorCode ?? 'sin código';
    const description =
      response.error?.errorDescription ?? 'Descope no devolvió detalles';
    throw new Error(`No se pudo ${operation}: ${code} — ${description}.`);
  }

  return response.data;
}
