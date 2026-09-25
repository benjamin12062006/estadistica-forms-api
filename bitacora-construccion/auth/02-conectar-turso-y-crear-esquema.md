# 02 — Conectar Turso y crear el esquema inicial

Fecha: 2026-09-23
Estado: Implementado y verificado
Ámbito: persistencia de usuarios en la API Nest
Relacionada con: [01-validar-sesion-descope.md](./01-validar-sesion-descope.md) y [plan de etapas](../../docs/plans/03-etapas-autenticacion-descope-turso.md)

## Necesidad y punto de partida

La etapa 2 pide conectar la base creada en Turso, validar su configuración y preparar
una migración versionada para `app_users` con identidad externa única. La aplicación
todavía no tiene módulo de base de datos ni tabla de usuarios.

El plan anterior proponía `@tursodatabase/serverless`. La URL local, inspeccionada
solo por su esquema y sin mostrarla, empieza con `libsql://`. La documentación
vigente de Turso distingue el motor libSQL del motor nuevo de Turso: para esta base
corresponde `@libsql/client/web`.[^F4] El paquete `@tursodatabase/database` ya
figura en el proyecto, pero está documentado para uso local/embebido, no para la
URL remota existente.[^F4]

## Evidencia e interpretación

Fernando Herrera configura la conexión de Postgres desde variables de entorno y
separa la configuración de la base del resto de módulos Nest.[^F1] También explica
que los cambios de esquema en producción se gestionan con migraciones, no con
sincronización automática de entidades.[^F2]

Otro curso de Nest muestra un riesgo concreto de `synchronize`: puede eliminar
columnas y datos sin historial de cambios; recomienda migraciones SQL incrementales.[^F3]
Esto respalda un archivo SQL explícito, aunque ninguno de esos cursos enseña el
cliente libSQL de Turso.

La documentación oficial de Turso recomienda `@libsql/client/web` para Vercel cuando
la base es libSQL y muestra `execute` con parámetros.[^F4] El SDK documenta que
`batch(..., 'write')` ejecuta varias sentencias en una transacción: si falla una,
se revierte todo el lote.[^F6] SQLite documenta que una
restricción `UNIQUE` compuesta protege la pareja de columnas, junto con `NOT NULL`
para impedir identidades incompletas.[^F5]

Nest espera el hook asíncrono `onModuleInit()` antes de considerar iniciada la
aplicación.[^F7] Por eso una consulta `SELECT 1` allí detecta la conexión rota al
arranque sin añadir una ruta pública de diagnóstico.

## Alternativas y decisión

| Enfoque | Evidencia y límite | Decisión |
| --- | --- | --- |
| `@tursodatabase/serverless` | Turso lo dirige a bases del motor Turso con URL `turso://`.[^F4] | Descartado para la URL `libsql://` existente. |
| `@libsql/client/web` | Turso lo dirige a libSQL remoto y Vercel.[^F4] | Elegido para el proveedor Nest y la migración. |
| TypeORM `synchronize` | Los cursos lo usan para desarrollo, pero advierten sobre cambios automáticos.[^F2][^F3] | Descartado; se guardará SQL versionado y se aplicará explícitamente. |

## Implementación y funcionamiento

| Decisión | Código | Adaptación |
| --- | --- | --- |
| Conexión remota libSQL con configuración externa[^F1][^F4] | [`TursoService`](../../src/database/turso.service.ts) y [`TursoModule`](../../src/database/turso.module.ts) | Valida URL/token, usa `@libsql/client/web`, comprueba `SELECT 1` durante `onModuleInit()` y cierra el cliente con el ciclo de Nest.[^F7] |
| Esquema explícito con identidad única[^F5] | [`001_create_app_users.sql`](../../migrations/001_create_app_users.sql) | Guarda ID propio, emisor, sujeto, contacto opcional y fechas; no guarda credenciales de Descope. |
| Migración controlada, sin sincronización automática[^F1][^F3][^F6] | [`migrate.mjs`](../../scripts/db/migrate.mjs) y `package.json` — `db:migrate` | Aplica los SQL numerados solo por comando explícito y registra cada versión en `schema_migrations`. |
| Prueba aislada del esquema | [`verify-migration.mjs`](../../scripts/db/verify-migration.mjs) y `package.json` — `db:verify` | Usa una base en memoria; aplica dos veces, inserta, lee y comprueba que una identidad duplicada se rechaza. |

La conexión Nest solo realiza una lectura al arrancar. El SQL no se aplica en cada
inicio de la API ni se creó todavía un endpoint de usuarios; eso pertenece a la
etapa 3.

## Comprobación

| Comprobación | Resultado observado |
| --- | --- |
| Estado inicial | Módulo Turso ausente; URL local de tipo `libsql://`; token presente sin mostrarlo. |
| `pnpm build` y `pnpm lint` | Ambos terminaron con código 0. |
| `pnpm db:verify` | Migración repetible en memoria; inserción, lectura y rechazo de la pareja de identidad duplicada. |
| `SELECT 1` remoto con credenciales locales | Conexión correcta; previamente no existían `app_users` ni `schema_migrations`. |
| `pnpm db:migrate` remoto | Aplicó `001_create_app_users.sql` sin imprimir credenciales. |
| Inicio de contexto Nest y lectura del esquema remoto | `TursoService` conectó; tabla, `UNIQUE(identity_issuer, identity_subject)` y versión registrada presentes. |
| Segunda ejecución de `pnpm db:migrate` | Terminó correctamente sin reaplicar el SQL. |

La comprobación global `pnpm format:check` detectó formato pendiente en
`src/auth/descope-session.guard.ts`, que ya estaba modificado por otro trabajo antes
de esta etapa. Los archivos nuevos de Turso se formatearon por separado; no se tocó
ese archivo ajeno. Ningún usuario de prueba se insertó en la base remota.

## Consecuencias y continuidad

La etapa 3 consumirá la conexión y la tabla para aprovisionar el perfil mediante el
`issuer` y `subject` ya validados por el guard de Descope. La migración se aplicó a la
base remota que apuntaba la configuración local el 2026-09-23; los entornos que usen
otra base deben ejecutar `pnpm db:migrate` con sus propias variables de entorno.

## Fuentes

[^F1]: [121. Conectar Postgres con Nest](</Users/benji/Documents/chrome-extencions/trancripciones/NestJS/NestJS Backend Completo/Sección 10 TypeORM - Postgres/121. Conectar Postgres con Nest.md>). Instructor: Fernando Herrera. Curso: *NestJS Backend Completo*. Sección 10: TypeORM - Postgres. Ruta relativa a la biblioteca: `NestJS/NestJS Backend Completo/Sección 10 TypeORM - Postgres/121. Conectar Postgres con Nest.md`. Localizador: líneas 13–17 y 21–35. Consulta: 2026-09-23.
[^F2]: [103. Configuración de variables de entorno](</Users/benji/Documents/chrome-extencions/trancripciones/NestJS/NestJS Backend Completo/Sección 9 Variables de entorno - Deployment y Dockerizar la aplicación/103. Configuración de variables de entorno.md>). Instructor: Fernando Herrera. Curso: *NestJS Backend Completo*. Sección 9. Ruta relativa a la biblioteca: `NestJS/NestJS Backend Completo/Sección 9 Variables de entorno - Deployment y Dockerizar la aplicación/103. Configuración de variables de entorno.md`. Localizador: líneas 13–17. Consulta: 2026-09-23. Véase también la fuente F1, líneas 27–35, sobre migraciones.
[^F3]: [49. TypeORM Synchronize: A Production Warning](</Users/benji/Documents/chrome-extencions/trancripciones/NestJS/NestJS API Profesional/Sección 4 Databases & Professional Configuration/49. TypeORM Synchronize A Production Warning.md>). Curso: *Go from zero to a deployed & tested NestJS API with TypeScript, TypeORM, PostgreSQL & Docker*. Sección 4: Databases & Professional Configuration. Ruta relativa a la biblioteca: `NestJS/NestJS API Profesional/Sección 4 Databases & Professional Configuration/49. TypeORM Synchronize A Production Warning.md`. Localizador: líneas 13–21. Consulta: 2026-09-23.
[^F4]: Turso, *Vercel*, sección “SQL over HTTP” y “Quickstart”, https://docs.turso.tech/integrations/vercel; y *Turso Quickstart (TypeScript)*, sección “Remote libSQL database”, https://docs.turso.tech/sdk/ts/quickstart. Consulta: 2026-09-23.
[^F5]: SQLite, *CREATE TABLE*, secciones “The CREATE TABLE command” y “UNIQUE constraints”, https://www.sqlite.org/lang_createtable.html. Consulta: 2026-09-23.
[^F6]: Turso, *Reference (TypeScript)*, secciones “Placeholders” y “Batch Transactions”, https://docs.turso.tech/sdk/ts/reference. Consulta: 2026-09-23.
[^F7]: NestJS, *Lifecycle events*, secciones “Lifecycle sequence” y “Asynchronous initialization”, https://docs.nestjs.com/fundamentals/lifecycle-events. Consulta: 2026-09-23.
