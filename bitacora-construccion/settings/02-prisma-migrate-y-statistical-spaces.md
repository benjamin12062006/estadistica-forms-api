# 02 — Prisma Migrate y repositorio de espacios

- Fecha: 2026-09-24
- Plan: [`docs/ormprisma/02-plan-prisma-sqlite-docker.md`](../../docs/ormprisma/02-plan-prisma-sqlite-docker.md)
- Punto de control previo: `v0.2.0` (`f7fc66a`)

## Propósito

Completar la segunda etapa de persistencia sin perder la historia SQL existente: `prisma/migrations` gobierna desde ahora SQLite local y Turso, mientras `statistical-spaces` deja de depender de `TursoService`.

## Construcción

- Se crearon tres migraciones bajo `prisma/migrations/`, equivalentes a los tres archivos históricos de `migrations/`.
- Se amplió `schema.prisma` con la relación `AppUser → StatisticalSpace` y el índice de propietario/fecha/id.
- Se aplicó un baseline con `prisma migrate resolve --applied` a la base existente, previa copia `.data/estadistica-dev.before-prisma-baseline.db`.
- Se reemplazaron los comandos ambiguos por destinos explícitos `db:local:*` y `db:turso:*`.
- Se retiró del Compose el segundo ejecutor de migraciones; el contenedor permanece como herramienta SQLite.
- Se migró `StatisticalSpacesRepository` a `PrismaService` usando únicamente `$queryRaw` seguro.
- Se cambió el soporte de pruebas para crear cada esquema con `prisma migrate deploy`.
- Se añadió una preparación local mínima que solo crea el archivo SQLite vacío cuando no existe; Prisma sigue siendo quien crea todo el esquema.
- Se añadió `migrate-prisma-to-turso.mjs`, que consume los mismos `migration.sql`, verifica checksums y registra el historial remoto en `prisma_remote_migrations`.
- La Turso existente reconoció las tres migraciones antiguas y las registró como baseline, sin repetir el esquema.

## Evidencia

```text
Prisma schema is valid
3 migrations found in prisma/migrations
Database schema is up to date
tests 16
pass 16
fail 0
```

La primera ejecución de las pruebas reveló que Prisma Migrate 7 no crea por sí mismo el archivo SQLite ausente durante `migrate deploy`. El soporte de pruebas crea primero el archivo vacío y luego deja que Prisma aplique toda la historia. Esto no sustituye ni simula las migraciones.

## Continuidad

Las migraciones SQL antiguas y su ejecutor permanecen versionados como historia, pero ya no aparecen como comandos activos. Los cambios nuevos nacen en `prisma/schema.prisma` y `prisma/migrations`; local y Turso consumen esos mismos archivos mediante ejecutores distintos.
