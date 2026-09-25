# SQLite local con Docker Compose y DataGrip

Fecha de consulta y comprobación: 2026-09-24

## Qué se está ejecutando

El archivo [`docker-compose.yml`](../../docker-compose.yml) usa `alpine/sqlite:latest`. El servicio `sqlite` mantiene visible un contenedor de herramientas, pero SQLite sigue siendo una base embebida: los datos viven en `.data/estadistica-dev.db` y no existe un servidor ni un puerto de base de datos.

El directorio local `.data/` se monta como `/data` dentro del contenedor. Prisma Migrate se ejecuta desde el host y trabaja sobre ese mismo archivo; Compose no mantiene un segundo migrador.

## Arrancar y detener

Desde la raíz de `estadistica-forms-api`:

```bash
# Descargar la versión más reciente de la etiqueta latest
docker compose pull sqlite

# Arrancar el contenedor en segundo plano
docker compose up --detach sqlite

# Verificar que está running/healthy
docker compose ps

# Detenerlo sin borrar la base
docker compose stop sqlite

# Retirar el contenedor y la red; el archivo .data/estadistica-dev.db permanece
docker compose down
```

## Aplicar migraciones

```bash
pnpm db:local:migrate
```

El comando activo:

1. lee en orden `prisma/migrations/*/migration.sql`;
2. omite los cambios ya registrados;
3. aplica cada migración pendiente;
4. registra el resultado en `_prisma_migrations`.

Para ver el estado:

```bash
pnpm db:local:status
```

## Abrir la consola SQLite

Con el contenedor arrancado:

```bash
docker compose exec sqlite sqlite3 /data/estadistica-dev.db
```

Comandos útiles dentro de la consola:

```sql
.tables
.schema app_users
.schema statistical_spaces
SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY migration_name;
PRAGMA foreign_key_check;
.quit
```

También se puede ejecutar una consulta sin abrir la consola interactiva:

```bash
docker compose exec sqlite \
  sqlite3 /data/estadistica-dev.db \
  "SELECT migration_name FROM _prisma_migrations ORDER BY migration_name;"
```

## Conexión local creada en DataGrip

Proyecto de DataGrip:

```text
/Users/benji/DataGripProjects/Estadistica-proyect-db
```

Fuente de datos:

```text
Nombre: Estadistica Local SQLite
DBMS: SQLite
JDBC URL: jdbc:sqlite:/Users/benji/Documents/NEST+ASTRO/estadistica-forms-api/.data/estadistica-dev.db
```

DataGrip abre directamente el archivo del host. No debe configurarse `localhost`, un puerto, usuario ni contraseña. La prueba automática terminó sin problemas usando SQLite JDBC 3.51.1.0.

## Comprobación realizada

- `alpine/sqlite:latest` resolvió SQLite 3.53.4 al comprobar esta configuración.
- El contenedor `sqlite` puede mantenerse en ejecución sin levantar Nest.
- La base existente recibió un baseline no destructivo en `_prisma_migrations`; puede conservar `schema_migrations` como dato histórico, pero Prisma ya no lo consulta.
- Una base temporal nueva recibió las tres migraciones de Prisma y expuso `app_users`, `_prisma_migrations` y `statistical_spaces`.
- La conexión `Estadistica Local SQLite` respondió correctamente desde DataGrip.

## Fuentes

- [Imagen `alpine/sqlite` en Docker Hub](https://hub.docker.com/r/alpine/sqlite)
- [SQLite: cuándo usar SQLite](https://www.sqlite.org/whentouse.html)
- [JetBrains: DataGrip MCP Server](https://www.jetbrains.com/help/datagrip/mcp-server.html)
