# 05 — Espacios pertenecientes al usuario

Fecha: 2026-09-23
Última actualización: 2026-09-24
Estado: Implementado y verificado con base aislada
Ámbito: espacios estadísticos de la API Nest
Relacionada con: [etapa 4](./04-leer-y-editar-perfil.md) y [plan](../../docs/plans/03-etapas-autenticacion-descope-turso.md)

## Necesidad y evidencia

La etapa 5 pide proteger la creación y el listado de espacios, asignar propietario desde el usuario autenticado y persistirlos en Turso. La lección 185 de Fernando Herrera pasa el usuario autenticado desde el controlador al servicio para crear un producto asociado a él.[^F1] Otro curso demuestra un fallo de aislamiento: el segundo usuario veía la tarea del primero hasta que la consulta se filtró por el ID del usuario actual.[^F2]

Adaptación: `owner_id` referirá al ID local de `app_users`, no al email ni a un valor enviado por el cliente. `GET /statistical-spaces` consultará `WHERE owner_id = ?`; `POST` ignorará cualquier intento de seleccionar otro propietario y `CreateSpaceDto` con el `ValidationPipe` rechazará campos extra. No se añaden todavía membresías, invitaciones ni rutas por ID; esas políticas pertenecen a una etapa posterior.

## Implementación

| Decisión                                                   | Código                                                                                                                                                                                          | Adaptación                                                                                                                                                                                                                                          |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Propietario persistente, sin valor aportado por el cliente | [`002_create_statistical_spaces.sql`](../../migrations/002_create_statistical_spaces.sql) y [`003_index_statistical_spaces_owner.sql`](../../migrations/003_index_statistical_spaces_owner.sql) | `owner_id` referencia a `app_users.id`; se añade índice para el listado por propietario. La inserción usa `INSERT … SELECT` desde el usuario existente, sin depender únicamente de la configuración de claves foráneas de una conexión remota.[^F3] |
| Autenticación y entrada validada                           | [`StatisticalSpacesController`](../../src/statistical-spaces/statistical-spaces.controller.ts) y [`CreateSpaceDto`](../../src/statistical-spaces/statistical-spaces.dto.ts)                     | Ambos métodos usan el guard de Descope; `POST` acepta únicamente `name`.                                                                                                                                                                            |
| Propietario local requerido                                | [`StatisticalSpacesService`](../../src/statistical-spaces/statistical-spaces.service.ts)                                                                                                        | Resuelve el usuario por identidad validada. Sin perfil local, devuelve `404`.                                                                                                                                                                       |
| Persistencia y aislamiento                                 | [`StatisticalSpacesRepository`](../../src/statistical-spaces/statistical-spaces.repository.ts)                                                                                                  | Sustituye el arreglo en memoria; la consulta de listado exige `owner_id = ?`.[^F2]                                                                                                                                                                  |

No hay aún permiso compartido o membresía: por ahora “visible” significa “propio”. La regla de dueño aplicada es adaptación del curso de Fernando a Descope + ID local + libSQL; la sintaxis SQL concreta no procede de la transcripción.[^F1]

## Comprobación

| Comprobación ejecutada            | Resultado observado                                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm spaces:verify`              | 5 pruebas pasan: migraciones y referencia a usuarios, persistencia, aislamiento entre Alice y Bob, ausencia `404`, validación DTO `400` y arranque de controladores Nest con guard y DTOs configurados. |
| `pnpm users:verify`               | 8 pruebas de aprovisionamiento y perfil siguen pasando tras las nuevas migraciones.                                                                                                                     |
| `pnpm db:verify`                  | Las tres migraciones se aplican repetidamente en una base aislada sin duplicarse.                                                                                                                       |
| `pnpm lint` y Prettier focalizado | Código de salida 0.                                                                                                                                                                                     |

La comprobación global `pnpm format:check` sigue fallando únicamente en
`src/auth/descope-session.guard.ts`, archivo ya modificado antes de estas etapas.
No se reformateó para preservar ese trabajo ajeno.

Se intentó una prueba HTTP local sin tocar Turso, pero este entorno denegó abrir el puerto `127.0.0.1` (`EPERM`). Se sustituyó por inicialización Nest y verificación de metadatos de rutas/guards/esquemas, no por una afirmación de prueba HTTP. No se aplicaron aquí las migraciones `002`/`003` a la base remota: antes de ejecutar la API con ese entorno debe correrse `pnpm db:migrate` apuntando deliberadamente a la base correcta. El recorrido con un `sessionJwt` real sigue pendiente.

## Continuidad

La etapa 6 integrará el ciclo de sesión del frontend; la autorización de espacios compartidos necesitará una tabla de membresías y otra política. No se adelantaron esas capacidades.

## Fuentes

[^F1]: [185. Insertar userId en los productos](</Users/benji/Documents/chrome-extencions/trancripciones/NestJS/NestJS Backend Completo/Sección 13 Autenticación de autorización/185. Insertar userId en los productos.md>). Instructor: Fernando Herrera. Curso: _NestJS Backend Completo_. Sección 13: Autenticación de autorización. Ruta relativa a la biblioteca: `NestJS/NestJS Backend Completo/Sección 13 Autenticación de autorización/185. Insertar userId en los productos.md`. Localizador: líneas 13–23. Consulta: 2026-09-23.

[^F2]: [119. Final Verification (Test): Ensuring the Task List is Correctly Scoped](</Users/benji/Documents/chrome-extencions/trancripciones/NestJS/NestJS API Profesional/Sección 9 Advanced Security Authorization, Roles & Data Ownership/119. Final Verification (Test) Ensuring the Task List is Correctly Scoped.md>) y [120. Applying the Fix](</Users/benji/Documents/chrome-extencions/trancripciones/NestJS/NestJS API Profesional/Sección 9 Advanced Security Authorization, Roles & Data Ownership/120. Applying the Fix Scoping the Main Task List to the Current User.md>). Curso: _NestJS API Profesional_. Sección 9. Ruta relativa a la biblioteca: `NestJS/NestJS API Profesional/Sección 9 Advanced Security Authorization, Roles & Data Ownership/`. Localizador: lección 119, líneas 13–19; lección 120, líneas 13–17. Consulta: 2026-09-23.

[^F3]: SQLite, _Foreign Key Support_, sección “Enabling Foreign Key Support”, https://www.sqlite.org/foreignkeys.html. Consulta: 2026-09-23.
