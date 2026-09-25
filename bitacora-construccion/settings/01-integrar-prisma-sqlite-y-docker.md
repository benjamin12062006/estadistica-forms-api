# 01 — Integrar Prisma, SQLite local y Docker sin duplicar migraciones

Fecha de creación: 2026-09-24
Estado: Implementado y verificado
Ámbito: Configuración de persistencia y primera adopción de Prisma en `users`
Relacionada con: [Plan 02 de Prisma, SQLite y Docker](../../docs/plans/ormprisma/02-plan-prisma-sqlite-docker.md)
Revisión de partida: `1dd138b` con cambios locales previos sin confirmar

## Necesidad y punto de partida

Se necesita una base SQLite local persistente, administrable desde Docker Compose, y usar Prisma en el módulo `users` sin reemplazar el SQL existente como lenguaje de migraciones. Compose debe contener solamente herramientas de SQLite: no debe construir ni iniciar la API. Las mismas migraciones de `migrations/*.sql` deben poder aplicarse localmente y, mediante una ejecución separada y consciente, en Turso.

El proyecto ya cuenta con autenticación Descope, aprovisionamiento de usuarios, espacios estadísticos, tres migraciones SQL y pruebas. La intervención actual debe conservar esos avances y no modificar todavía `src/statistical-spaces/`.

## Evidencia e interpretación

El curso crea Compose en la raíz, construye la aplicación desde un Dockerfile y usa un volumen para vincular archivos del host y el contenedor.[^F1] En su ejemplo SQLite, explica además que la base se crea dentro del contenedor y que solo se reflejaría fuera mediante un volumen enlazado.[^F2]

La adaptación a este proyecto es montar los directorios `.data/` y `migrations/` en una imagen `alpine/sqlite:latest`. SQLite es el archivo, no un daemon: por eso no existe un puerto al cual conectarse y cada tarea se ejecuta mediante `docker compose run --rm`.

Prisma documenta el mismo conector `sqlite` para un archivo local y Turso, usando `@prisma/adapter-libsql`; también advierte que Prisma Migrate no se conecta directamente a Turso remoto.[^F3] Por ello Prisma se incorpora como cliente de consultas, mientras el ejecutor SQL existente conserva la autoridad exclusiva sobre el esquema.

## Alternativas y decisión

| Enfoque y fuente                                                  | Supuestos y ventajas para esta necesidad                                                                             | Coste o límite                                                                                   | Decisión y motivo                                   |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Contenedor separado de base de datos, como PostgreSQL en el curso | Útil cuando existe un servidor de base de datos independiente.                                                       | SQLite no es un daemon; añadir un servicio fingido no aporta aislamiento ni conectividad.        | Descartado para SQLite.                             |
| Archivo SQLite interno sin volumen                                | El contenedor puede crear y usar la base.                                                                            | El archivo se pierde o queda oculto al recrear el contenedor, tal como muestra la clase 93.[^F2] | Descartado para desarrollo persistente.             |
| Contenedor de herramientas + montaje de `.data/`                  | La imagen solicitada mantiene un contenedor visible y permite abrir el mismo archivo mediante `docker compose exec`. | No ofrece un puerto porque SQLite no usa red.                                                    | Elegido: `sqlite` persistente y `migrate` efímero.  |
| Prisma Migrate más ejecutor SQL propio                            | Dos historiales controlan el mismo esquema.                                                                          | Riesgo de divergencia entre `_prisma_migrations` y `schema_migrations`.                          | Descartado; solo `migrations/*.sql` aplica cambios. |

## Implementación y funcionamiento

La implementación siguió el [plan 02](../../docs/plans/ormprisma/02-plan-prisma-sqlite-docker.md) y se limitó a `users`.

```text
migrations/*.sql
        │
        ├── pnpm db:migrate + file:...   → SQLite local / Docker
        └── pnpm db:migrate + libsql://  → Turso, ejecución separada

Prisma schema (espejo) → Prisma Client → UsersRepository
                                  └────→ SQL parametrizado para el UPSERT

docker compose run --rm migrate → alpine/sqlite:latest → .data/estadistica-dev.db
docker compose up -d sqlite     → contenedor de herramientas visible y saludable
docker compose exec sqlite …    → consola SQLite sobre el mismo archivo
```

| Decisión respaldada                                                                       | Archivo y símbolo                                                                                                               | Adaptación realizada                                                                                                                                    |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un archivo Compose en la raíz coordina herramientas reproducibles.[^F1]                   | [`docker-compose.yml`](../../docker-compose.yml)                                                                                | `sqlite` permanece visible y saludable; `migrate` es efímero. Ambos usan `alpine/sqlite:latest` y comparten `.data/` y las migraciones en solo lectura. |
| Un solo conjunto de SQL gobierna todos los entornos.[^F3]                                 | [`scripts/db/migrate.mjs`](../../scripts/db/migrate.mjs)                                                                        | El ejecutor acepta `file:` sin token y `libsql://` con token; continúa leyendo exclusivamente `migrations/*.sql` y registrando `schema_migrations`.     |
| Prisma requiere adaptador y un cliente generado.[^F3]                                     | [`prisma/schema.prisma`](../../prisma/schema.prisma), [`PrismaService`](../../src/database/prisma.service.ts)                   | `AppUser` refleja `app_users`; `PrismaService` crea una única instancia inyectable mediante `@prisma/adapter-libsql`.                                   |
| SQL explícito sigue siendo válido para una operación especial.                            | [`UsersRepository`](../../src/users/users.repository.ts)                                                                        | Lectura y edición usan la API tipada. El aprovisionamiento conserva el `UPSERT` atómico mediante `$queryRaw` etiquetado y parametrizado.                |
| La configuración debe servir tanto al acceso antiguo como al nuevo durante la transición. | [`resolveDatabaseConnection`](../../src/database/database-connection.ts), [`TursoService`](../../src/database/turso.service.ts) | Prisma y libSQL resuelven la misma `DATABASE_URL`; `TURSO_DATABASE_URL` se mantiene como alias transitorio.                                             |

La prueba de arranque real reveló que `AuthModule` exportaba el guard pero no `DescopeService`, necesario cuando Nest resolvía el guard desde `UsersModule`. Se añadió esa exportación en [`AuthModule`](../../src/auth/auth.module.ts); no fue un cambio de reglas de autenticación.

Un primer prototipo construía y levantaba la API desde Compose. Tras precisar el alcance, ese Dockerfile se eliminó: SQLite no necesita un proceso residente ni un puerto, y Compose quedó limitado a crear, migrar y consultar el archivo local.

## Comprobación

| Comando, petición o prueba ejecutada                                         | Resultado observado                                                                                                                                                   |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm prisma:generate`                                                       | Prisma Client 7.10.0 generado correctamente desde `AppUser`.                                                                                                          |
| `pnpm db:verify`                                                             | Las tres migraciones se aplicaron; una segunda pasada no las duplicó; inserción, lectura y restricción única correctas.                                               |
| `pnpm db:local:migrate` dos veces                                            | Se creó `.data/estadistica-dev.db` y `schema_migrations` conservó exactamente `001`, `002` y `003`.                                                                   |
| `pnpm users:verify`                                                          | 8 pruebas aprobadas, incluidas concurrencia, identidad compuesta y edición de perfil.                                                                                 |
| `pnpm spaces:verify`                                                         | 5 pruebas aprobadas; la persistencia y el aislamiento de espacios continúan funcionando sin convertir su repositorio.                                                 |
| `pnpm build`                                                                 | Compilación Nest y generación previa de Prisma completadas.                                                                                                           |
| `pnpm lint`                                                                  | Sin diagnósticos.                                                                                                                                                     |
| `docker compose --profile tools config --quiet`                              | Definición válida, sin `build`, `ports` ni servicio de API.                                                                                                           |
| `docker pull alpine/sqlite:latest`                                           | Descargó `alpine/sqlite:latest` con digest `sha256:cd3fda4f01e81f3ea0142a9e3da0cfabfa4bf86669fdcbff1fbeb73d6ba313aa` en la fecha de la prueba.                        |
| `docker compose run --rm sqlite --version`                                   | `latest` resolvió SQLite `3.53.4` de 64 bits en la fecha de la prueba.                                                                                                |
| `docker compose run --rm migrate`                                            | Detectó correctamente que `001`, `002` y `003` ya estaban aplicadas en la base local persistente.                                                                     |
| `docker compose run --rm -e SQLITE_DATABASE=/data/compose-verify.db migrate` | Sobre una base temporal nueva aplicó las tres migraciones.                                                                                                            |
| `docker compose run --rm sqlite /data/compose-verify.db "…"`                 | Confirmó tres registros en `schema_migrations` y las tablas `app_users`, `schema_migrations` y `statistical_spaces`; luego se eliminó únicamente el archivo temporal. |
| `docker compose up --detach sqlite` + `docker compose ps`                    | `estadistica-forms-api-sqlite-1` quedó `Up` y `healthy`, sin publicar puertos.                                                                                        |
| `docker compose exec sqlite sqlite3 /data/estadistica-dev.db "…"`            | Consultó desde el contenedor las tres versiones aplicadas.                                                                                                            |
| Crear y probar `Estadistica Local SQLite` mediante DataGrip MCP              | Conexión SQLite JDBC 3.51.1.0 sin problemas; ping de comprobación de 4 ms.                                                                                            |

## Consecuencias y continuidad

La etapa 1 queda cerrada con evidencia local. `migrations/*.sql` continúa siendo la única historia de esquema y no se ejecutó nada contra Turso remoto. El contenedor `estadistica-forms-api-sqlite-1` queda ejecutándose como herramienta saludable, sin puerto; los datos permanecen en `.data/estadistica-dev.db`, ignorado por Git. DataGrip también quedó conectado directamente a ese archivo mediante la fuente `Estadistica Local SQLite`. La conversión de `statistical-spaces` pertenece a la etapa 2 y tendrá su propia entrada histórica; ningún archivo dentro de `src/statistical-spaces/` fue modificado por esta etapa.

## Fuentes

[^F1]: Fernando Herrera, “91. Crear red y levantar todo con un solo comando”, curso _NATS, Webhooks, CI/CD, Git submodules, Gateways, Docker, Kubernetes, GCloud, PostgreSQL, Mongo, SQLite_, sección 9. Archivo local: `/Users/benji/Documents/chrome-extencions/trancripciones/NestJS/Microservicios con NestJS/Sección 9 Docker - Crear docker compose/91. Crear red y levantar todo con un solo comando.md`, líneas 17-45. Consulta: 2026-09-24.

[^F2]: Fernando Herrera, “93. Docker compose build - ¿Qué pasa?”, mismo curso y sección. Archivo local: `/Users/benji/Documents/chrome-extencions/trancripciones/NestJS/Microservicios con NestJS/Sección 9 Docker - Crear docker compose/93. Docker compose build - ¿Qué pasa.md`, líneas 17-37. Consulta: 2026-09-24.

[^F3]: [Prisma, “SQLite database connector”](https://docs.prisma.io/docs/orm/core-concepts/supported-databases/sqlite), y [“Turso”](https://docs.prisma.io/docs/orm/v6/overview/databases/turso). Consulta: 2026-09-24.
