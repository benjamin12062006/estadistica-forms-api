# 04 — Retirar migrador SQL heredado

- Fecha de creación: 2026-09-25
- Estado: Implementado y verificado
- Ámbito: historia activa de migraciones, scripts de base de datos y dependencias
- Relacionada con: [02 — Prisma Migrate y repositorio de espacios](./02-prisma-migrate-y-statistical-spaces.md), [03 — Consultas SQL de usuarios con Prisma](./03-consultas-sql-de-usuarios-con-prisma.md) y [plan Prisma Migrate, SQLite local y `statistical-spaces`](../../docs/ormprisma/02-plan-prisma-sqlite-docker.md)
- Revisión de partida: `f7fc66a` (`v0.2.0`), sobre el incremento de persistencia pendiente de confirmar

## Necesidad y punto de partida

La etapa `02` estableció `prisma/migrations` como única historia activa para SQLite local y Turso, pero conservó temporalmente los artefactos que habían gobernado la versión anterior: `migrations/`, `scripts/db/migrate.mjs` y `scripts/db/verify-migration.mjs`.

Se decidió cerrar la transición y retirar esos archivos para que el árbol de trabajo no sugiera que existen dos caminos válidos para modificar el esquema. Los comandos activos de `package.json` ya usaban solo `db:local:*`, `db:turso:*` y las migraciones Prisma; por ello se conservan sin un alias antiguo.

## Evidencia e interpretación

El plan activo establece que las migraciones nuevas nacen en `prisma/schema.prisma` y `prisma/migrations`, se aplican localmente con Prisma Migrate y se despliegan a Turso mediante `migrate-prisma-to-turso.mjs`.[^F1]

**Interpretación:** mantener el migrador previo después de completar el baseline no aporta una capacidad de ejecución necesaria. En cambio, facilita que alguien ejecute accidentalmente `schema_migrations` y la historia Prisma sobre el mismo esquema.

**Adaptación:** el baseline remoto sigue siendo comprobable sin ejecutar el código eliminado. La prueba crea la tabla histórica `schema_migrations` y sus tres versiones mínimas en memoria, y verifica que el ejecutor de Turso las reconoce como `baselined`.

## Implementación y funcionamiento

| Decisión                         | Archivo o artefacto                                                                    | Resultado                                                                                                              |
| -------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Una sola historia ejecutable     | Se elimina `migrations/`                                                               | Los tres cambios iniciales viven únicamente en `prisma/migrations/*/migration.sql`.                                    |
| Retirar ejecutores obsoletos     | Se eliminan `scripts/db/migrate.mjs` y `scripts/db/verify-migration.mjs`               | No queda un comando o script que aplique `schema_migrations`.                                                          |
| Mantener prueba de transición    | [`test/turso-prisma-migrations.test.mjs`](../../test/turso-prisma-migrations.test.mjs) | Simula solo el registro histórico para comprobar el baseline, sin importar el migrador eliminado.                      |
| Mantener dependencias necesarias | [`package.json`](../../package.json) y [`pnpm-lock.yaml`](../../pnpm-lock.yaml)        | Se conserva `@libsql/client` para el ejecutor Prisma de Turso y se retira `@tursodatabase/database`, sin consumidores. |
| Versionar el hito                | [`package.json`](../../package.json)                                                   | La versión de aplicación avanza de `0.2.0` a `0.3.0`.                                                                  |

Las consultas de la aplicación no se modifican: `UsersRepository` y `StatisticalSpacesRepository` continúan usando la única instancia `PrismaService`. Tampoco cambian las migraciones: se retira la copia histórica, no los `migration.sql` de Prisma.

## Comprobación

| Comando o revisión                  | Resultado observado                                                                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm db:verify`                    | Compilación correcta; 3/3 pruebas aprobaron el despliegue Prisma, su repetición y el baseline Turso simulado sin el migrador heredado. |
| `pnpm users:verify`                 | Compilación correcta; 8/8 pruebas de aprovisionamiento, lectura y edición aprobaron.                                                   |
| `pnpm spaces:verify`                | Compilación correcta; 5/5 pruebas de rutas, esquema, propiedad y validación aprobaron.                                                 |
| `pnpm lint`                         | `oxlint --type-aware src/` terminó con 0 errores y 0 advertencias.                                                                     |
| Búsqueda de referencias ejecutables | Solo la prueba de baseline conserva el nombre histórico `schema_migrations`; no queda importación ni comando del migrador eliminado.   |

## Consecuencias y continuidad

A partir de esta entrada, el flujo permitido para un cambio de esquema es:

```text
schema.prisma → db:local:migration:create → revisión de prisma/migrations → db:local:migrate → db:turso:migrate
```

Las bitácoras y planes anteriores conservan el contexto de la transición; no deben interpretarse como instrucciones activas. La documentación operativa remite a los comandos Prisma actuales.

## Fuentes

[^F1]: [Plan Prisma Migrate, SQLite local y `statistical-spaces`](../../docs/ormprisma/02-plan-prisma-sqlite-docker.md), secciones “Resultado”, “Comandos vigentes” y “Regla para cambios futuros”. Consulta: 2026-09-25.
