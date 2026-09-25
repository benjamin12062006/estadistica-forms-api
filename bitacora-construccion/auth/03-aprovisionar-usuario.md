# 03 — Aprovisionar el usuario local

Fecha: 2026-09-23
Estado: Implementado y verificado con base aislada
Ámbito: usuarios autenticados en la API Nest
Relacionada con: [etapa 2](./02-conectar-turso-y-crear-esquema.md) y [plan de etapas](../../docs/plans/03-etapas-autenticacion-descope-turso.md)

## Necesidad y punto de partida

La etapa 3 requiere `PUT /api/v1/users/me`: una sesión Descope validada debe crear o recuperar exactamente un usuario local en Turso. El esquema `app_users` y el guard ya existen; todavía no existe un módulo `users`.

## Evidencia e interpretación

Fernando Herrera muestra la separación entre el controlador que recibe la petición y el servicio que persiste al usuario; también observa que repetir un registro choca con la unicidad de la base.[^F1] Su ejemplo usa registro por email/contraseña con TypeORM: no es el contrato de este proyecto, que recibe la identidad exclusivamente del JWT validado.

SQLite documenta `ON CONFLICT` para una restricción `UNIQUE` y permite actualizar solo si cambia un dato; Turso documenta `execute` con argumentos parametrizados.[^F2][^F3] La adaptación es una única sentencia `UPSERT` sobre `(identity_issuer, identity_subject)` que devuelve su fila con `RETURNING`.

## Decisiones y adaptación

- `DescopeSessionGuard` es la fuente de `issuer`, `subject` y email presente en el token validado. La firma valida la procedencia del claim, pero esta etapa no comprueba por separado un estado de verificación del correo.
- `PUT /users/me` ignora el body para identidad, rol, nombre y contraseña. El ID local se genera en el servidor.
- La restricción `UNIQUE` resuelve peticiones repetidas o concurrentes; el email no es una clave. Solo se actualiza si llega un valor distinto desde el token. Una ausencia no borra el valor existente.
- `display_name` permanece vacío hasta una fuente confiable o una ruta de edición de perfil (etapa 4).

El curso crea un usuario con credenciales propias y recibe un DTO del cliente; aquí se conservan la separación controlador/servicio/persistencia y el aprendizaje sobre unicidad, pero se descartan registro por contraseña y email como identidad primaria. La sentencia `UPSERT` y las reglas de actualización son adaptación propia respaldada por SQLite/Turso, no código del instructor.[^F1][^F2][^F3]

## Implementación y funcionamiento

| Decisión | Código | Resultado |
| --- | --- | --- |
| Sesión obligatoria e identidad solo del guard | [`UsersController.provisionCurrentUser`](../../src/users/users.controller.ts) | `PUT /api/v1/users/me` usa `DescopeSessionGuard`; no extrae datos del body. |
| Coordinación de la operación | [`UsersService.provision`](../../src/users/users.service.ts) y [`UsersModule`](../../src/users/users.module.ts) | Conecta el endpoint con la persistencia, reutilizando los módulos de auth y Turso. |
| Inserción/actualización atómica basada en identidad externa | [`UsersRepository.provision`](../../src/users/users.repository.ts) | SQL parametrizado con `ON CONFLICT`; conserva `id` y `created_at`, y solo cambia `updated_at` cuando cambia el email. |
| Entrada en la aplicación y preflight | [`AppModule`](../../src/app.module.ts) y [`main.ts`](../../src/main.ts) | Importa el módulo y permite `PUT` en CORS. |
| Comprobación reproducible | [`users-provisioning.test.mjs`](../../test/users-provisioning.test.mjs), [`users.http`](../../requests/users.http) y `users:verify` en [`package.json`](../../package.json) | Prueba automática aislada y petición manual sin credenciales versionadas. |

El `PUT` responde `200` con `{ user: { id, email, displayName, createdAt, updatedAt } }`. El ID de Descope y el emisor se usan internamente como clave única, pero no se devuelven en este perfil. No hay endpoint de lectura o edición de perfil: corresponden a la etapa 4.

## Comprobación

| Comprobación ejecutada | Resultado observado |
| --- | --- |
| `pnpm users:verify` | Compiló y pasaron 4 pruebas con libSQL en memoria y la migración real: repetición idempotente, actualización de email, separación por emisor/sujeto y 12 peticiones concurrentes que dejan una sola fila. |
| `pnpm db:verify` | La migración de la etapa 2 sigue siendo repetible y su restricción única rechaza una inserción duplicada. |
| `pnpm lint` | Código de salida 0. |
| Prettier sobre los archivos de código modificados | Sin diferencias de formato. |

No se insertó ningún usuario de prueba en la base Turso remota ni se ejecutó todavía una petición HTTP `200` con un JWT real. La ruta `401` reutiliza el guard de la etapa 1, pero tampoco se volvió a probar por HTTP en este incremento. La comprobación aislada demuestra el SQL y la restricción de unicidad; el recorrido Descope → Nest → Turso remoto sigue como prueba manual pendiente.

## Continuidad

Para la prueba manual, arrancar la API con la configuración existente, obtener un `sessionJwt` temporal del proyecto y ejecutar dos veces la petición de [`users.http`](../../requests/users.http): ambas respuestas deben tener el mismo `user.id`. No guardar ese JWT en Git. La etapa 4 añadirá lectura y edición segura del perfil; no se adelantó aquí.

## Fuentes

[^F1]: [167. Crear usuario](</Users/benji/Documents/chrome-extencions/trancripciones/NestJS/NestJS Backend Completo/Sección 13 Autenticación de autorización/167. Crear usuario.md>). Instructor: Fernando Herrera. Curso: *NestJS Backend Completo*. Sección 13: Autenticación de autorización. Ruta relativa a la biblioteca: `NestJS/NestJS Backend Completo/Sección 13 Autenticación de autorización/167. Crear usuario.md`. Localizador: líneas 13–19, 31–41. Consulta: 2026-09-23.
[^F2]: SQLite, *UPSERT*, secciones “Description” y “Examples”, https://www.sqlite.org/lang_upsert.html. Consulta: 2026-09-23.
[^F3]: Turso, *Reference (TypeScript)*, sección “Simple query”, https://docs.turso.tech/sdk/ts/reference. Consulta: 2026-09-23.
