# 02 — Prisma con SQLite local, Docker y SQL compartido con Turso

Fecha de creación: 2026-09-24
Estado: Etapa 1 implementada y verificada; etapa 2 planificada
Ámbito: Persistencia de `users` y preparación posterior de `statistical-spaces`
Relacionada con: [01-plan-integracion.md](./01-plan-integracion.md), [03.1-sistem-dev-prod-dblocal.md](../03.1-sistem-dev-prod-dblocal.md)
Revisión de referencia: `1dd138b` con cambios locales previos sin confirmar

## Objetivo

Incorporar Prisma Client sobre el mismo esquema SQLite/libSQL que ya usa la API, sin crear una segunda historia de migraciones y sin perder la posibilidad de escribir SQL explícito. El resultado de la primera etapa será:

- una base SQLite local persistente en `.data/estadistica-dev.db`;
- la base local administrable mediante servicios de herramienta definidos únicamente en `docker-compose.yml`;
- `migrations/*.sql` como única fuente de cambios del esquema, tanto localmente como en Turso;
- `users` consultado mediante Prisma y SQL parametrizado donde el `UPSERT` existente aporta una semántica útil;
- `statistical-spaces` sin cambios hasta una segunda etapa independiente.

## Punto de partida

La API ya dispone de tres migraciones SQL numeradas, un ejecutor propio que registra `schema_migrations`, repositorios basados en `@libsql/client` y pruebas sobre SQLite en memoria. `UsersRepository` y `StatisticalSpacesRepository` comparten `TursoService`, que actualmente exige una URL remota `libsql://` y un token.

No se parte de un proyecto limpio: la revisión `1dd138b` tiene trabajo local previo de autenticación, usuarios y espacios estadísticos. Esta integración debe conservarlo y limitar la conversión ORM a `users`.

SQLite es una biblioteca embebida que trabaja con un archivo, no un servidor que escuche en un puerto. Docker Compose no levantará Nest ni fingirá un servidor SQLite: mantendrá visible un contenedor de herramientas basado en `alpine/sqlite:latest`, mientras el archivo real permanece montado en `.data/`. Las migraciones seguirán ejecutándose como tareas efímeras.

## Fuentes y decisiones

La clase 91 del curso local sitúa `docker-compose.yaml` en la raíz y usa volúmenes para compartir archivos entre host y contenedor.[^F1] La clase 93 muestra que el archivo SQLite creado dentro del contenedor no se refleja en el host salvo que se monte un volumen.[^F2] Su Dockerfile para la API no se traslada porque el alcance solicitado es únicamente administrar SQLite.

La documentación vigente de Prisma admite tanto archivos SQLite `file:` como Turso `libsql://` con `@prisma/adapter-libsql`. Prisma 7 requiere un adaptador de driver y un cliente generado con ruta de salida explícita.[^F3] Prisma también documenta que una conexión remota Turso por HTTP no debe recibir `prisma migrate dev`; los cambios remotos se aplican por un flujo externo.[^F4]

Decisiones del proyecto:

1. `migrations/*.sql` y `scripts/db/migrate.mjs` seguirán siendo la única autoridad de migraciones.
2. No se ejecutará `prisma migrate`, `prisma db push` ni se creará `_prisma_migrations`.
3. `prisma/schema.prisma` reflejará el esquema existente; no lo gobernará.
4. `DATABASE_URL` seleccionará `file:` local o `libsql://` remoto. `TURSO_DATABASE_URL` se conservará temporalmente como compatibilidad de configuración remota y `TURSO_AUTH_TOKEN` solo será obligatorio con `libsql://`.
5. Prisma Client será una única dependencia inyectable de Nest. En `users`, las lecturas y actualizaciones simples usarán su API tipada; el aprovisionamiento conservará el `INSERT ... ON CONFLICT ... RETURNING` como SQL parametrizado a través de Prisma.
6. Compose usará `alpine/sqlite:latest`, montará `./.data` y `./migrations`, no expondrá puertos y no construirá ni iniciará Nest.
7. `docker compose up --detach sqlite` mantendrá visible el contenedor; `docker compose run --rm migrate` aplicará los SQL numerados y `docker compose exec sqlite sqlite3 /data/estadistica-dev.db` abrirá la consola.

## Incrementos

### Etapa 1 — `users` (se implementa ahora)

1. Crear la configuración y el esquema Prisma que mapean únicamente `app_users` sin generar migraciones nuevas.
2. Añadir un `PrismaService` único con `@prisma/adapter-libsql`, compatible con `file:` y `libsql://`.
3. Adaptar el ejecutor SQL y `TursoService` para compartir `DATABASE_URL`; así `statistical-spaces` seguirá funcionando sin cambiar su código.
4. Migrar `UsersRepository` a Prisma, preservando el `UPSERT` atómico en SQL parametrizado.
5. Añadir solo `docker-compose.yml` en la raíz con un contenedor de herramientas `sqlite` y una tarea efímera `migrate`, ambos basados en `alpine/sqlite:latest` y con persistencia de `.data/`.
6. Actualizar variables de ejemplo y scripts para generación, migración y arranque reproducible.
7. Adaptar las pruebas de usuarios para comprobar Prisma contra una base SQLite temporal creada por las migraciones SQL reales.

### Etapa 2 — `statistical-spaces` (queda planificada, no se implementa ahora)

1. Incorporar `statistical_spaces` y su relación con `app_users` al esquema Prisma sin modificar los SQL históricos.
2. Comparar las consultas actuales, incluyendo ordenación y pertenencia por `owner_id`, contra la API tipada de Prisma.
3. Migrar el repositorio por operaciones pequeñas, manteniendo SQL explícito donde exprese mejor la consulta.
4. Ejecutar las pruebas existentes de aislamiento entre usuarios y añadir pruebas de paridad antes de retirar cualquier acceso antiguo.
5. Eliminar `TursoService` solo si ya no queda ningún consumidor; no hacerlo de forma anticipada.

## Comprobación prevista

| Incremento              | Evidencia esperada                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configuración Prisma    | `pnpm prisma:generate` finaliza y el cliente representa `app_users`.                                                                                                                                                |
| Migraciones compartidas | `pnpm db:verify` aplica dos veces los mismos `migrations/*.sql` sin duplicarlos.                                                                                                                                    |
| SQLite local            | `DATABASE_URL=file:./.data/estadistica-dev.db pnpm db:migrate` crea el archivo y registra las tres migraciones.                                                                                                     |
| Repositorio de usuarios | `pnpm users:verify` conserva aprovisionamiento idempotente, identidad compuesta, lectura y edición del perfil.                                                                                                      |
| API completa            | `pnpm build`, `pnpm lint` y las pruebas de espacios existentes permanecen en verde.                                                                                                                                 |
| Compose                 | `docker compose up --detach sqlite` deja el contenedor saludable; `docker compose run --rm migrate` aplica el esquema y `docker compose exec sqlite sqlite3 …` permite consultar el archivo sin servidor ni puerto. |
| Alcance                 | El diff no modifica archivos dentro de `src/statistical-spaces/`.                                                                                                                                                   |

## Límites y continuidad

- Esta etapa no modifica `statistical-spaces`, no crea nuevas tablas y no aplica cambios a Turso remoto.
- La ejecución remota de `pnpm db:migrate` queda bajo control explícito del usuario con las credenciales del entorno deseado.
- No se crea un Dockerfile, no se expone un puerto y no se guardan secretos en Compose, documentación ni Git.
- La etapa 2 comenzará solamente después de verificar la etapa 1 y comparar el comportamiento del repositorio actual de espacios.

## Fuentes

[^F1]: Fernando Herrera, “91. Crear red y levantar todo con un solo comando”, curso _NATS, Webhooks, CI/CD, Git submodules, Gateways, Docker, Kubernetes, GCloud, PostgreSQL, Mongo, SQLite_, sección 9. Archivo local: `/Users/benji/Documents/chrome-extencions/trancripciones/NestJS/Microservicios con NestJS/Sección 9 Docker - Crear docker compose/91. Crear red y levantar todo con un solo comando.md`, líneas 17-45. Consulta: 2026-09-24.

[^F2]: Fernando Herrera, “93. Docker compose build - ¿Qué pasa?”, mismo curso y sección. Archivo local: `/Users/benji/Documents/chrome-extencions/trancripciones/NestJS/Microservicios con NestJS/Sección 9 Docker - Crear docker compose/93. Docker compose build - ¿Qué pasa.md`, líneas 17-37. Consulta: 2026-09-24.

[^F3]: [Prisma, “SQLite database connector”](https://docs.prisma.io/docs/orm/core-concepts/supported-databases/sqlite), secciones “Setup”, “Using driver adapters” y “Supported variants”. Consulta: 2026-09-24. Véase también [“Introduction to Prisma Client”](https://docs.prisma.io/docs/orm/prisma-client/setup-and-configuration/introduction).

[^F4]: [Prisma, “Turso”](https://docs.prisma.io/docs/orm/v6/overview/databases/turso), secciones “Differences to consider” y “Manage schema changes with Turso”. Consulta: 2026-09-24.
