# 05 — Usar Turso en la API de desarrollo

Fecha de creación: 2026-10-19
Estado: Implementado y verificado
Ámbito: Configuración de ejecución de la API Nest/Prisma; sin cambios de esquema.
Relacionada con: [persistencia Prisma](02-prisma-migrate-y-statistical-spaces.md), [consultas de usuarios](03-consultas-sql-de-usuarios-con-prisma.md), [ejecución actual](../../README.md).
Revisión de partida: `17009ea`, con cambios locales anteriores en código, peticiones y tsconfig preservados.

## Necesidad y evidencia

El usuario pide usar Turso después de observar fechas distintas entre la base remota y las pantallas. La API de desarrollo abría `.data/estadistica-dev.db`: `DATABASE_URL` seleccionaba `file:` aunque había una URL y token de Turso configurados. [resolveDatabaseConnection](../../src/database/database-connection.ts) elige primero `DATABASE_URL` y después `TURSO_DATABASE_URL`; el código existente ya admite `libsql://` con token. Por ello basta cambiar la configuración y reiniciar.

## Cambio aplicado

En el `.env` ignorado se reemplaza únicamente `DATABASE_URL` por la URL remota ya existente en `TURSO_DATABASE_URL`; se conserva el token existente sin copiarlo al código ni a este documento. No se cambia el resolvedor ni PrismaService ni los contratos de Flutter/Nuxt. El README distingue el destino activo de la opción SQLite.

Se detuvieron solo los procesos identificados del Nest anterior y se inició `pnpm start:dev` desde la raíz de la API, con `DATABASE_URL` heredada eliminada del entorno del comando para que Nest cargue el `.env` actualizado. El servidor queda escuchando en `127.0.0.1:8080`. El servidor web no se reinició.

## Comprobación

- Consulta SELECT mediante `@libsql/client`: conexión remota correcta y perfil existente recuperado, con `created_at = 2026-10-16T11:57:37.838Z`, coincidente con la captura de Turso del usuario.
- Consulta SELECT mediante [PrismaService](../../src/database/prisma.service.ts) y el resolvedor compilado: destino `libsql://`, mismo perfil y fecha. No se ejecutaron INSERT, UPDATE, migraciones ni aprovisionamiento de usuarios.
- Arranque de Nest en modo watch: compilación sin errores, conexión inicializada y servidor iniciado correctamente.
- `GET /api/v1/auth/me` sin credenciales al servidor reiniciado: HTTP 401 esperado.
- El proceso anterior tenía abierto el archivo SQLite; el proceso reiniciado ya no lo tiene abierto.

## Límites

La base SQLite permanece intacta y sus registros no se copiaron a Turso. Las pantallas deben volver a leer su perfil para sustituir el dato que mantienen en memoria. La diferencia de representación UTC/Nueva York de la fecha es otro asunto y no se modificó. No se inició sesión ni se cambió la configuración remota de Descope.
