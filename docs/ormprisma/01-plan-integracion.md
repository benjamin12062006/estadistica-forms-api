# Plan histórico sustituido

> **Estado:** este plan documenta la decisión anterior. La transición se completó en [`02-plan-prisma-sqlite-docker.md`](./02-plan-prisma-sqlite-docker.md) y el retiro de los artefactos heredados se registra en [`04-retirar-migrador-sql-heredado.md`](../../bitacora-construccion/settings/04-retirar-migrador-sql-heredado.md). No ejecutes los comandos o scripts antiguos que se mencionan más abajo: ya no existen en el proyecto.

Sí, es válido combinar Prisma y SQL manual en un mismo proyecto. Lo que no conviene es tener dos sistemas independientes modificando la misma base sin una sola autoridad de migraciones.

Hay que separar dos cosas:

```text
Consultas de la aplicación
Migraciones del esquema
```

Para las consultas, podrías usar Prisma para operaciones normales:

```ts
prisma.appUsers.findUnique(...)
prisma.statisticalSpaces.create(...)
```

y mantener SQL para consultas especiales:

```ts
prisma.$queryRaw(...)
prisma.$executeRaw(...)
```

Eso es soportado. Deben usarse las variantes seguras con parámetros; evita `...Unsafe` con valores externos. [Prisma: raw queries](https://www.prisma.io/docs/orm/v6/prisma-client/using-raw-sql/raw-queries)

Pero para las migraciones, en nuestro caso hay una limitación importante: la documentación de Prisma indica que una base Turso remota por `libsql://` es incompatible con `Prisma Migrate` directo, porque Turso conecta por HTTP. Prisma recomienda generar el cambio con `prisma migrate diff` y aplicarlo mediante Turso. [Prisma + Turso](https://docs.prisma.io/docs/orm/v6/overview/databases/turso)

Así que, para este proyecto actual:

```text
Prisma Client para consultas        → sí, posible
SQL manual para consultas especiales → sí, posible
Prisma Migrate directo a Turso      → no recomendado / incompatible
Nuestro script de migraciones       → sigue siendo el dueño adecuado
```

La regla sana sería:

```text
Una sola base
Una sola historia de migraciones
Un solo proceso que las aplica
```

No haríamos esto:

```text
Prisma Migrate modifica Turso
y al mismo tiempo
scripts/db/migrate.mjs modifica Turso
```

porque podrían divergir los historiales:

```text
_prisma_migrations
vs.
schema_migrations
```

Tendrías dos “verdades” sobre qué cambió en la base.

La opción más coherente si adoptamos Prisma sería:

```text
Prisma Client + @prisma/adapter-libsql
para consultas tipadas

migrations/*.sql + scripts/db/migrate.mjs
para migraciones reales de Turso
```

Y las consultas SQL que acabamos de documentar pueden seguir existiendo; Prisma no obliga a eliminar SQL. Lo que cambiaría después, por decisión nuestra, sería qué consultas merece la pena convertir a Prisma y cuáles siguen siendo SQL explícito.

No: no debes ejecutar Prisma Migrate y Turso Migrate sobre la misma base ni apuntar ambos al mismo historial como si fueran dos ejecutores equivalentes.

Si ambos ejecutan el mismo SQL en Turso:

```text
Prisma ejecuta 004_create_forms.sql
Turso ejecuta 004_create_forms.sql otra vez
```

la segunda ejecución puede fallar porque la tabla ya existe, o peor, quedar marcada de forma diferente en cada sistema.

Cada uno mantiene su propio registro:

```text
Prisma Migrate → _prisma_migrations
Nuestro script → schema_migrations
```

Por eso deben tener un solo dueño para aplicar cambios en cada base.

Lo que sí puedes hacer es esto:

```text
Desarrollo local SQLite
└─ Prisma Migrate aplica una migración una vez

Producción Turso
└─ Turso CLI o nuestro script aplica ese mismo SQL una vez
```

El archivo SQL puede ser el mismo cambio lógico, pero no se ejecuta dos veces en la misma base.

Una posible estructura futura sería:

```text
prisma/
└─ migrations/
   └─ 20260924_create_forms/
      └─ migration.sql
```

Y el flujo:

```text
1. Prisma genera y prueba migration.sql en SQLite local.
2. Revisamos el SQL.
3. Turso aplica ese migration.sql remoto una sola vez.
4. No ejecutamos prisma migrate deploy contra Turso.
```

Pero para el proyecto actual, usar ese híbrido añadiría complejidad: habría que adaptar nuestro script para leer las carpetas de Prisma y decidir cómo registrar cada migración aplicada en Turso.

Por ahora, la regla más clara es:

```text
Turso remoto → migrations/*.sql + scripts/db/migrate.mjs
Prisma       → no controla migraciones todavía
```

Si adoptamos Prisma después, puede usarse para las consultas, pero antes de mover las migraciones hay que elegir un único sistema de historial y despliegue.
