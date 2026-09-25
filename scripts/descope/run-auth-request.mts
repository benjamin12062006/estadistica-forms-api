import DescopeClient, { type SdkResponse } from '@descope/node-sdk';
import { spawn, spawnSync } from 'node:child_process';
import { setDefaultResultOrder } from 'node:dns';
import { chmod, writeFile } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sessionEnvironmentFile = resolve(projectRoot, 'requests', '.env');
type ApiProcess = {
  exitCode: number | null;
  kill(signal: NodeJS.Signals): boolean;
  once(event: 'exit', listener: () => void): unknown;
};

setDefaultResultOrder('ipv4first');
loadLocalEnvironment();

const projectId = requireEnvironment('DESCOPE_PROJECT_ID');
const managementKey = requireEnvironment('DESCOPE_MANAGEMENT_KEY');
const testLoginId = requireEnvironment('DESCOPE_TEST_LOGIN_ID');

const descope = DescopeClient({ projectId, managementKey });

const startedApi = await ensureApiRunning();

try {
  await runAuthenticationTest();
} finally {
  delete process.env.TEST_SESSION_JWT;
  await stopApi(startedApi);
}

async function runAuthenticationTest(): Promise<void> {
  await ensureTestUser();

  const authentication = await authenticateTestUser();

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

  process.env.TEST_SESSION_JWT = sessionJwt;
  await saveSessionJwt(sessionJwt);

  console.log(
    'Sesión validada y guardada localmente en requests/.env. ' +
      'Ejecutando GET /api/v1/auth/me…',
  );

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
      env: process.env,
      encoding: 'utf8',
    },
  );

  if (requestResult.error) {
    throw requestResult.error;
  }

  if (requestResult.status !== 0) {
    throw new Error(
      `httpyac terminó con código ${requestResult.status ?? 'desconocido'}. ` +
        'La salida se ocultó para impedir que el JWT aparezca en la terminal.',
    );
  }

  console.log('Prueba autenticada completada correctamente (HTTP 2xx).');
}

async function authenticateTestUser() {
  console.log('Solicitando un OTP temporal para el usuario de prueba…');
  const otp = requireResponseData(
    await descope.management.user.generateOTPForTestUser('email', testLoginId),
    'generar el OTP de prueba',
  );

  const otpAuthentication = await descope.otp.verify.email(
    testLoginId,
    otp.code,
  );

  if (otpAuthentication.ok && otpAuthentication.data) {
    return otpAuthentication.data;
  }

  if (otpAuthentication.error?.errorCode !== 'E061001') {
    return requireResponseData(otpAuthentication, 'verificar el OTP de prueba');
  }

  console.log(
    'Email OTP está deshabilitado. Probando automáticamente con Magic Link…',
  );
  const magicLink = requireResponseData(
    await descope.management.user.generateMagicLinkForTestUser(
      'email',
      testLoginId,
      '',
    ),
    'generar el Magic Link de prueba',
  );
  const magicLinkToken = new URL(
    magicLink.link,
    'https://local.invalid',
  ).searchParams.get('t');

  if (!magicLinkToken) {
    throw new Error(
      'Descope devolvió un Magic Link sin token de verificación.',
    );
  }

  return requireResponseData(
    await descope.magicLink.verify(magicLinkToken),
    'verificar el Magic Link de prueba',
  );
}

async function saveSessionJwt(sessionJwt: string): Promise<void> {
  const content = [
    '# Generado por pnpm api:auth-test. No guardar en Git.',
    `TEST_SESSION_JWT=${sessionJwt}`,
    '',
  ].join('\n');

  await writeFile(sessionEnvironmentFile, content, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await chmod(sessionEnvironmentFile, 0o600);
}

async function ensureApiRunning(): Promise<ApiProcess | undefined> {
  const initialStatus = await getUnauthenticatedStatus();
  if (initialStatus !== undefined) {
    assertUnauthenticatedStatus(initialStatus);
    console.log(
      'API Nest detectada. Respuesta sin sesión verificada (HTTP 401).',
    );
    return undefined;
  }

  console.log('La API no está activa. Compilando el proyecto…');
  const nestExecutable = resolve(
    projectRoot,
    'node_modules/.bin',
    process.platform === 'win32' ? 'nest.cmd' : 'nest',
  );
  const buildResult = spawnSync(nestExecutable, ['build'], {
    cwd: projectRoot,
    env: process.env,
    encoding: 'utf8',
  });

  if (buildResult.error) {
    throw buildResult.error;
  }

  if (buildResult.status !== 0) {
    throw new Error('No se pudo compilar la API Nest antes de la prueba.');
  }

  console.log('Iniciando la API Nest temporalmente…');
  const apiProcess = spawn(process.execPath, ['dist/main.js'], {
    cwd: projectRoot,
    env: process.env,
    stdio: 'ignore',
  });

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (apiProcess.exitCode !== null) {
      throw new Error(
        `La API Nest terminó antes de estar disponible (código ${apiProcess.exitCode}).`,
      );
    }

    const status = await getUnauthenticatedStatus();
    if (status !== undefined) {
      assertUnauthenticatedStatus(status);
      console.log(
        'API Nest iniciada. Respuesta sin sesión verificada (HTTP 401).',
      );
      return apiProcess;
    }

    await delay(250);
  }

  apiProcess.kill('SIGTERM');
  throw new Error('La API Nest no respondió en 10 segundos.');
}

async function getUnauthenticatedStatus(): Promise<number | undefined> {
  try {
    const response = await fetch('http://127.0.0.1:8080/api/v1/auth/me', {
      signal: AbortSignal.timeout(1_000),
    });
    return response.status;
  } catch {
    return undefined;
  }
}

function assertUnauthenticatedStatus(status: number): void {
  if (status !== 401) {
    throw new Error(
      `GET /api/v1/auth/me sin JWT devolvió HTTP ${status}; se esperaba HTTP 401.`,
    );
  }
}

async function stopApi(apiProcess: ApiProcess | undefined): Promise<void> {
  if (!apiProcess || apiProcess.exitCode !== null) {
    return;
  }

  apiProcess.kill('SIGTERM');
  await Promise.race([
    new Promise<void>((resolveExit) => {
      apiProcess.once('exit', resolveExit);
    }),
    delay(2_000),
  ]);

  if (apiProcess.exitCode === null) {
    apiProcess.kill('SIGKILL');
  }

  console.log('API Nest temporal detenida.');
}

async function ensureTestUser(): Promise<void> {
  console.log('Comprobando el usuario de prueba en Descope…');

  const search = requireResponseData(
    await descope.management.user.searchTestUsers({
      loginIds: [testLoginId],
      testUsersOnly: true,
      limit: 10,
    }),
    'buscar el usuario de prueba',
  );

  const exactUser = search.users.find((user) =>
    user.loginIds.includes(testLoginId),
  );

  if (exactUser?.test) {
    console.log('El usuario de prueba ya existe. Se reutilizará.');
    return;
  }

  if (!testLoginId.includes('@')) {
    throw new Error(
      'DESCOPE_TEST_LOGIN_ID debe ser un correo porque esta prueba usa OTP por email.',
    );
  }

  const createdUser = requireResponseData(
    await descope.management.user.createTestUser(testLoginId, {
      email: testLoginId,
      displayName: 'Auth API Test User',
      verifiedEmail: true,
    }),
    'crear el usuario de prueba',
  );

  if (!createdUser.test) {
    throw new Error(
      'Descope creó el usuario, pero no lo marcó como usuario de prueba.',
    );
  }

  console.log('Usuario de prueba creado correctamente.');
}

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

    if (code === 'E023017') {
      throw new Error(
        `No se pudo ${operation}: ${code} — ${description}. ` +
          'La Management Key de .env no autoriza la IP pública actual. ' +
          'Actualiza Permitted IPs en Company > Management Keys y vuelve a ejecutar.',
      );
    }

    throw new Error(`No se pudo ${operation}: ${code} — ${description}.`);
  }

  return response.data;
}
