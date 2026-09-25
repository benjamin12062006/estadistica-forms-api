# 02 — Prisma Migrate, SQLite local y `statistical-spaces`

- Fecha de creación: 2026-09-24
- Fecha de finalización: 2026-09-24
- Estado: completado
- Ámbito: migraciones Prisma locales y acceso Prisma para `users` y `statistical-spaces`
- Punto de control previo: `v0.2.0` (`f7fc66a`)

## Resultado

`prisma/migrations` es ahora la única fuente activa de cambios para SQLite local y Turso. Cada base tiene su propio ejecutor porque Prisma Migrate no se despliega directamente sobre `libsql://`. La historia anterior no se borró:

- `migrations/001_create_app_users.sql`, `002_create_statistical_spaces.sql` y `003_index_statistical_spaces_owner.sql` permanecen intactas como registro histórico;
- `schema_migrations` y los datos existentes permanecen en `.data/estadistica-dev.db`;
- `scripts/db/migrate.mjs` y `scripts/db/verify-migration.mjs` se conservan como implementación histórica, pero ningún script activo de `package.json` los ejecuta;
- `prisma/migrations/` contiene una historia nueva, equivalente y separada;
- `_prisma_migrations` registra el estado local;
- `prisma_remote_migrations` registra en Turso exactamente los mismos archivos y sus checksums.

## Decisión de transición

No se ejecutaron otra vez los `CREATE TABLE` sobre la base existente. Se creó un baseline Prisma uno a uno y se marcó como aplicado con `prisma migrate resolve`:

| Historia anterior                        | Historia Prisma activa                          |
| ---------------------------------------- | ----------------------------------------------- |
| `001_create_app_users.sql`               | `20260924000100_create_app_users`               |
| `002_create_statistical_spaces.sql`      | `20260924000200_create_statistical_spaces`      |
| `003_index_statistical_spaces_owner.sql` | `20260924000300_index_statistical_spaces_owner` |

Este procedimiento conserva tablas, restricciones, índices y datos. Una base nueva ejecuta los mismos tres cambios mediante `prisma migrate deploy`; la base existente solo recibió los registros de baseline en `_prisma_migrations`. Antes del baseline se creó la copia local ignorada por Git `.data/estadistica-dev.before-prisma-baseline.db`.

La técnica sigue el flujo oficial para incorporar Prisma Migrate a una base que ya contiene datos: crear una migración inicial representativa y marcarla como aplicada en el entorno existente.[^F1]

## Arquitectura resultante

```text
NestJS
  ├── UsersRepository ───────────────┐
  └── StatisticalSpacesRepository ──┤
                                     ▼
                               PrismaService
                                     ▼
                     @prisma/adapter-libsql
                                     ▼
                  .data/estadistica-dev.db

prisma/schema.prisma
          │
          └── prisma/migrations/*/migration.sql
                          ├── SQLite local: prisma migrate deploy
                          └── Turso: migrate-prisma-to-turso.mjs
```

`TursoModule` y `TursoService` se conservan en el árbol por historia, pero ya no se registran ni tienen consumidores en la aplicación. El recorrido activo de ambos repositorios pasa únicamente por `PrismaService`.

## Etapa 1 — usuarios

Completada antes de este incremento:

- `AppUser` refleja `app_users`;
- `UsersRepository` recibe `PrismaService`;
- el aprovisionamiento atómico usa SQL parametrizado con `Prisma.sql`;
- lectura y edición del perfil conservan su comportamiento y sus pruebas.

## Etapa 2 — espacios estadísticos

Completada en este incremento:

1. Se añadió `StatisticalSpace`, su relación con `AppUser` y el índice compuesto al esquema Prisma.
2. `StatisticalSpacesModule` importa `PrismaModule` en lugar de `TursoModule`.
3. `StatisticalSpacesRepository` recibe `PrismaService`.
4. Todas sus operaciones usan exclusivamente `prisma.$queryRaw` con `Prisma.sql` y valores interpolados de forma parametrizada; no usa `$queryRawUnsafe`.
5. La consulta de lista conserva `WHERE owner_id = ...` y `ORDER BY created_at DESC, id DESC`.
6. La creación conserva `INSERT ... SELECT ... RETURNING`, por lo que no puede crear un espacio si el propietario dejó de existir.
7. Las pruebas crean bases nuevas mediante `prisma migrate deploy`, no mediante el ejecutor SQL anterior.

Las consultas raw seguras de Prisma parametrizan valores cuando se usa el template tag; los identificadores y fragmentos estructurales siguen siendo texto controlado por la aplicación.[^F2]

## Comandos vigentes

```bash
pnpm prisma:generate
pnpm db:local:prepare
pnpm db:local:migrate
pnpm db:local:migration:create -- --name nombre_del_cambio
pnpm db:local:status
pnpm db:turso:migrate
pnpm db:turso:status
docker compose up --detach sqlite
```

Docker Compose no aplica migraciones y no levanta un servidor SQLite. Solo mantiene un contenedor de herramientas sobre el mismo archivo enlazado desde `.data/`; Prisma Migrate se ejecuta desde el proyecto en el host.

`db:local:migrate` prepara el directorio y el archivo vacío cuando se parte de un clon nuevo; el esquema sigue siendo creado exclusivamente por `prisma migrate deploy`.

`db:local:migration:create` no crea otra base. Usa la misma SQLite local, pero tiene una responsabilidad diferente: compara `schema.prisma`, crea un nuevo directorio dentro de `prisma/migrations` y aplica ese cambio durante el desarrollo.

`db:turso:migrate` lee esos mismos directorios, valida sus checksums y aplica solamente los pendientes mediante una transacción libSQL. Las tres migraciones que el ejecutor antiguo ya había aplicado en Turso quedaron registradas como `baselined`; no se repitió ningún `CREATE TABLE`.

## Verificación realizada

| Comprobación                                       | Resultado                                                  |
| -------------------------------------------------- | ---------------------------------------------------------- |
| `prisma validate` y `prisma generate`              | esquema válido y cliente generado                          |
| Baseline sobre `.data/estadistica-dev.db`          | tres migraciones marcadas; esquema actualizado             |
| Base temporal vacía + `prisma migrate deploy`      | crea las tres migraciones desde cero                       |
| Pruebas de usuarios, espacios, rutas y migraciones | 16/16 aprobadas                                            |
| Ejecutor Turso sobre base vacía                    | aplica las tres migraciones y es repetible                 |
| Transición de Turso existente                      | registra las tres migraciones como baseline                |
| Repositorio de espacios                            | sin `TursoService`, `$queryRawUnsafe` ni API CRUD generada |
| Restricción de propietario e índice                | comprobados en SQLite                                      |

## Regla para cambios futuros

1. Modificar `prisma/schema.prisma`.
2. Crear la migración con `pnpm db:local:migration:create -- --name ...` sobre la SQLite local.
3. Revisar y versionar el `migration.sql` generado.
4. Aplicar localmente con `pnpm db:local:migrate`.
5. Aplicar a Turso con `pnpm db:turso:migrate`.
6. No añadir cambios nuevos a `migrations/*.sql` ni volver a ejecutar el migrador histórico sobre esta base.

## Fuentes

[^F1]: [Prisma — Baselining a database](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining). Consulta: 2026-09-24.

[^F2]: [Prisma — Raw queries](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries). Consulta: 2026-09-24.
