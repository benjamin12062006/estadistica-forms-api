# 03 — Consultas SQL de usuarios con Prisma

- Fecha de creación: 2026-09-25
- Estado: Implementado y verificado
- Ámbito: acceso a `app_users` mediante `PrismaService`
- Relacionada con: [02 — Prisma Migrate y repositorio de espacios](./02-prisma-migrate-y-statistical-spaces.md) y [plan Prisma Migrate, SQLite local y `statistical-spaces`](../../docs/ormprisma/02-plan-prisma-sqlite-docker.md)
- Revisión de partida: `f7fc66a` (`v0.2.0`), sobre un conjunto de cambios de persistencia aún sin confirmar

## Necesidad y punto de partida

El repositorio de usuarios ya recibía una única instancia de `PrismaService` y el aprovisionamiento ya usaba SQL seguro con `prisma.$queryRaw(Prisma.sql`...`)`. Sin embargo, `findByIdentity` y `updateDisplayName` usaban los delegates generados `prisma.appUser.findUnique` y `prisma.appUser.update`.

Se pidió que las tres operaciones de `users` vuelvan a mostrar su SQL explícito dentro de [`UsersRepository`](../../src/users/users.repository.ts), siguiendo el mismo patrón que [`StatisticalSpacesRepository`](../../src/statistical-spaces/statistical-spaces.repository.ts), sin cambiar el contrato público de usuarios ni abrir una conexión distinta.

## Evidencia e interpretación

La lección consultada explica que `SELECT ... FROM ... WHERE` elige columnas y limita las filas leídas mediante una condición.[^F1] La misma sección explica que `UPDATE ... SET ... WHERE` cambia columnas de las filas que cumplen la condición.[^F2]

> “The condition after the WHERE clause is used to control, which rows should actually be fetched.” [^F1]

**Interpretación:** las dos partes de la identidad externa, `identity_issuer` e `identity_subject`, son la condición adecuada para leer o modificar solo el usuario local correspondiente. La lección enseña SQL general; no enseña Nest, Prisma, SQLite/Turso ni la semántica particular de `RETURNING`.

**Adaptación del proyecto:** las sentencias se construyen con `Prisma.sql` y se ejecutan desde la instancia ya inyectada de `PrismaService`. Los valores de identidad y perfil siguen parametrizados; los nombres de tabla, columnas y fragmentos SQL permanecen estáticos y controlados por la aplicación. Esta es la misma regla de consultas raw seguras adoptada en la entrada anterior.[^F3]

## Alternativas y decisión

| Enfoque                                                     | Ventaja                                                                                                           | Coste o límite                                                                                                                          | Decisión                                    |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Delegates generados `appUser.findUnique` y `appUser.update` | API CRUD tipada generada desde `schema.prisma`.                                                                   | La consulta SQL y los alias dejan de estar visibles junto al comportamiento.                                                            | Sustituido en `users` por petición expresa. |
| `$queryRaw` con `Prisma.sql`                                | Mantiene SQL explícito, parámetros seguros y una única conexión Prisma; iguala el estilo de `statistical-spaces`. | La forma de las filas se declara manualmente con `UserProjection`; TypeScript no valida el resultado de la base en tiempo de ejecución. | Elegido.                                    |
| `$queryRawUnsafe` o concatenación de valores                | Podría formar SQL dinámico.                                                                                       | Introduce riesgo de inyección y no es necesario.                                                                                        | Descartado.                                 |

## Implementación y funcionamiento

Los tres métodos del repositorio usan ahora `this.prisma.$queryRaw<UserProjection[]>(Prisma.sql`...`)`:

| Operación                                  | SQL y responsabilidad                                           | Resultado                                                                                                 |
| ------------------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `provision(identity)`                      | `INSERT ... ON CONFLICT ... RETURNING`                          | Crea o actualiza el usuario conservando la semántica atómica previa.                                      |
| `findByIdentity(identity)`                 | `SELECT ... WHERE identity_issuer = ? AND identity_subject = ?` | Devuelve una fila transformada a `LocalUser`, o `null`.                                                   |
| `updateDisplayName(identity, displayName)` | `UPDATE ... SET ... CASE ... WHERE ... RETURNING`               | Actualiza solo el nombre; si no hay fila devuelve `null`, y si no cambia el nombre conserva `updated_at`. |

Las columnas SQL `display_name`, `created_at` y `updated_at` se proyectan con los alias `displayName`, `createdAt` y `updatedAt`. Así la fila raw coincide con `UserProjection` y el método privado `toLocalUser` conserva el contrato expuesto a `UsersService` y al controlador.

[`src/users/sql/users.sql`](../../src/users/sql/users.sql) se mantiene como referencia legible de esas tres sentencias, con `?` como representación de parámetros. El archivo ejecutable es el repositorio; Prisma reemplaza esa representación por parámetros reales mediante el template tag seguro.

El recorrido no cambia:

```text
UsersController → UsersService → UsersRepository → PrismaService → PrismaLibSql → URL configurada
```

La URL se resuelve en [`resolveDatabaseConnection`](../../src/database/database-connection.ts). En esta sesión, la configuración efectiva de `.env` indicó `libsql:`, por lo que la API normal apunta a Turso; al ejecutar `db:local:*`, los scripts fuerzan `DATABASE_URL=file:./.data/estadistica-dev.db`. Cada ejecución usa un solo destino, nunca ambos a la vez.

## Comprobación

| Comando, petición o prueba ejecutada | Resultado observado                                                                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm users:verify`                  | `prisma generate` y `nest build` correctos; 8/8 pruebas de aprovisionamiento, lectura y edición de usuarios aprobadas sobre SQLite temporal migrada. |

## Consecuencias y continuidad

El modelo `AppUser` de `schema.prisma`, el cliente generado en `src/generated/prisma/` y `PrismaService` siguen siendo necesarios: Prisma genera la clase y sus utilidades, y `PrismaService` administra la conexión. Que las tres operaciones de `users` usen SQL raw no cambia las migraciones ni crea una segunda base o cliente.

Para cambios futuros en tablas o columnas se conserva la regla de la entrada `02`: modificar `schema.prisma`, crear una migración en `prisma/migrations`, aplicarla primero a SQLite local y después a Turso. Cambiar una consulta del repositorio no requiere una migración si el esquema no cambia.

## Fuentes

[^F1]: “71. Selecting Data: Theory”, curso _From data definition to manipulation (CRUD, relations, JOIN): Learn SQL for MySQL, Postgresql & more from the ground up!_, sección “Sección 5: Data Manipulation & Querying: CRUD Operations With SQL”. Archivo local: `/Users/benji/Documents/chrome-extencions/trancripciones/SQL/SQL Completo/Sección 5 Data Manipulation & Querying CRUD Operations With SQL/71. Selecting Data Theory.md`, líneas 12-15. Consulta: 2026-09-25.

[^F2]: “72. Updating Data: Theory”, mismo curso y sección. Archivo local: `/Users/benji/Documents/chrome-extencions/trancripciones/SQL/SQL Completo/Sección 5 Data Manipulation & Querying CRUD Operations With SQL/72. Updating Data Theory.md`, líneas 12-15. Consulta: 2026-09-25.

[^F3]: [Plan Prisma Migrate, SQLite local y `statistical-spaces`](../../docs/ormprisma/02-plan-prisma-sqlite-docker.md), sección “Etapa 2 — espacios estadísticos”, líneas 69-77; registra la decisión previa del proyecto de usar `$queryRaw` con `Prisma.sql` sin `$queryRawUnsafe`. Consulta: 2026-09-25.
