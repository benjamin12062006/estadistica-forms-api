# Plan incremental — usuarios y autenticación con Descope

> **Actualización (2026-09-21):** Turso Cloud es la persistencia elegida. El orden
> vigente y la división en entregas pequeñas están en
> [`03-etapas-autenticacion-descope-turso.md`](./03-etapas-autenticacion-descope-turso.md).
> Las menciones históricas a PostgreSQL/TypeORM de este documento quedan sustituidas
> por esa decisión.

## Decisión de arquitectura

Usaremos una responsabilidad por capa:

```text
Persona → Descope Flow / SDK web → session JWT → Astro → Bearer token
→ Nest Guard → identidad validada → reglas del producto y datos propios
```

- **Descope** registra o reconoce a la persona mediante Google o Magic Link, emite y actualiza la sesión.
- **Astro** presenta el Flow inicialmente y envía únicamente el `session JWT` a la API como `Authorization: Bearer <token>`.
- **Nest** valida el JWT en cada ruta protegida y aplica las reglas del producto.
- **La base de datos propia** guardará el perfil de la aplicación, los espacios y sus miembros. No almacena contraseñas, refresh tokens ni copias de sesiones de Descope.

Por tanto, no crearemos `POST /auth/register` ni `POST /auth/login` en Nest. Con Descope, *registro* e *inicio de sesión* son acciones `Sign Up or In` del Flow. El backend no debe convertirse en un segundo emisor de JWT ni administrar credenciales que Descope ya protege.

La guía oficial de Node indica que el backend obtiene el token del encabezado `Authorization`, valida la sesión y debe comprobar la audiencia (`aud`) con el Project ID. El cliente no autoriza por sí mismo: solo transporta el token a la API. [Node.js Quickstart](https://docs.descope.com/getting-started/nodejs) · [Web Client Sessions](https://docs.descope.com/sessions/management/web).

## Estado comprobado al terminar el incremento 1

- La API Nest escucha en `127.0.0.1:8080`, usa el prefijo `/api` y versión `/v1`.
- `statistical-spaces` todavía se almacena en memoria y no tiene propietario.
- `@descope/node-sdk` versión `2.17.0` ya aparece en `package.json` y `pnpm-lock.yaml`: el primer incremento no requiere instalar una dependencia nueva.
- CORS permite los orígenes de Astro y el encabezado `Authorization`.
- Turso Cloud es la persistencia elegida, pero todavía no existe una tabla de usuarios.
  No se simulará una tabla ni se añadirán repositorios vacíos antes de la etapa 2.

## Conceptos: usuario de identidad y usuario del producto

| Concepto | Dueño | Se crea cuándo | Identificador estable |
| --- | --- | --- | --- |
| Identidad autenticada | Descope | Al completar `Sign Up or In` | `sub` / `userId` de Descope |
| Perfil de la aplicación | Nuestra API | Al aprovisionar por primera vez una identidad validada | UUID interno + pareja `issuer`/`subject` única |
| Rol dentro de un espacio | Nuestra API | Al crear/invitar a un miembro del espacio | Relación `spaceMembership` |

El correo es útil como dato de contacto o presentación, pero no como identidad primaria: puede cambiar. Nunca aceptaremos un `identitySubject`, rol o propietario desde el cuerpo que envía el navegador; esos valores salen del token validado o de una regla de servidor.

## Configuración mínima en Descope antes de escribir código

1. En **Métodos de autenticación**, configurar Google y Magic Link por correo.
2. En **Flujos**, confirmar un Flow que ofrezca `Sign Up or In / Google` y `Sign Up or In / Magic Link`.
3. Probar el Flow en la consola con una cuenta real y verificar que aparece en **Usuarios**. Es la comprobación de que Descope puede crear una identidad.
4. Copiar el **Project ID**. No es una contraseña, pero se conservará como configuración y no se incluirá en respuestas ni capturas públicas sin necesidad.
5. Mantener la plantilla JWT OIDC por defecto y la entrega de tokens en el cuerpo de respuesta durante `localhost`. No crear una plantilla JWT, una management key, roles globales ni un conector OAuth propio en este incremento.

Para Magic Link usaremos la acción **Sign Up or In**: si la persona no existe, Descope la registra; si existe, la autentica. [Magic Link](https://docs.descope.com/auth-methods/magic-link).

## Plan por incrementos verificables

### Incremento 0 — Tener una sesión real que probar

**Objetivo:** poder obtener una sesión de Descope sin construir aún una pantalla de login propia.

**Acciones:** terminar la configuración anterior y usar la previsualización del Flow. Cuando integremos Astro, empezaremos por el Flow alojado o embebido: es el camino con menos frontend y permite aislar la validación de Nest. El SDK Web con una pantalla totalmente personalizada quedará para después de que el backend funcione.

**Evidencia de cierre:** existe un usuario de prueba en Descope y el navegador puede obtener un `session JWT` sin exponer el refresh token en Git ni en archivos `.http` versionados.

### Incremento 1 — Validar sesión en Nest, sin base de datos

**Objetivo:** demostrar que solo una sesión emitida para este proyecto entra a una ruta protegida.

**Cambios mínimos previstos:**

- Crear `src/auth/` con un módulo, un proveedor que inicialice `DescopeClient({ projectId })` y un guard de sesión.
- Añadir `DESCOPE_PROJECT_ID` a `.env.example`; `.env` conserva el valor local. No se necesita `managementKey` para `validateSession`.
- El guard exige exactamente `Authorization: Bearer <session-jwt>`, valida el token con `audience: DESCOPE_PROJECT_ID` y transforma errores o formatos inválidos en `401 Unauthorized`.
- El guard normaliza las claims necesarias en `request.authenticatedIdentity`; ninguna ruta usa el JWT sin validar como fuente de autoridad.
- Crear `GET /api/v1/auth/me`, protegido, que devuelva una representación mínima de la identidad validada. Esta ruta es una sonda: todavía no crea una fila local.
- Añadir `Authorization` a `allowedHeaders` de CORS. Seguimos usando Bearer tokens, no cookies ni `credentials`, en desarrollo local.
- Crear una petición manual `requests/auth.http` con una variable local para el token. El token real no se guarda en el repositorio.

**Comprobación:**

| Petición | Resultado esperado |
| --- | --- |
| `GET /auth/me` sin encabezado | `401` |
| Token con prefijo incorrecto o alterado | `401` |
| Session JWT válida de este Project ID | `200` con identidad mínima |
| Preflight desde Astro que pide `Authorization` | `204` y permite el encabezado |

**No se hará todavía:** perfiles persistentes, cambio de correo, desactivar usuarios, roles, ownership ni proteger `statistical-spaces`.

### Incremento 2 — Preparar persistencia en Turso

**Objetivo:** conectar la base de Turso Cloud ya elegida antes de afirmar que existe
un «usuario de nuestra aplicación».

La URL de la base existente usa `libsql://`, por lo que usamos `@libsql/client/web`
con SQL parametrizado y una migración versionada. El cambio y su verificación están
registrados en [la bitácora de la etapa 2](../../bitacora-construccion/auth/02-conectar-turso-y-crear-esquema.md).
No activaremos funciones experimentales ni introduciremos TypeORM en este incremento.

**Modelo mínimo que aparecerá tras esa decisión:**

```text
app_users
  id                UUID interno, clave primaria
  identity_issuer   texto, obligatorio
  identity_subject  texto, obligatorio e inmutable en nuestro dominio
  email             texto de contacto, no clave de autenticación
  display_name      texto opcional
  created_at
  updated_at
  deactivated_at    opcional
```

La pareja `(identity_issuer, identity_subject)` será única. El modelo no incluirá
`password`, `passwordHash`, refresh tokens ni un arreglo de roles globales.

**Evidencia de cierre:** una migración crea la tabla desde cero y una prueba de integración puede insertar y recuperar un perfil.

### Incremento 3 — Aprovisionar el perfil local

**Objetivo:** convertir una identidad validada en un usuario del producto, una sola vez y sin confiar en datos enviados por el cliente.

**Contrato previsto:**

- `PUT /api/v1/users/me` con sesión válida aprovisiona de forma idempotente el perfil propio usando el `sub`/`userId` validado.
- La primera llamada crea el perfil; las posteriores devuelven el mismo perfil o actualizan únicamente los datos permitidos obtenidos desde las claims.
- `GET /api/v1/users/me` devuelve el perfil de la aplicación. No devuelve tokens ni claims completas.

Esto es distinto de un endpoint de registro con email y contraseña. La cuenta de Descope se creó antes; aquí creamos su representación dentro de nuestro producto.

**Evidencia de cierre:** dos solicitudes consecutivas con la misma identidad dejan una sola fila; dos identidades diferentes dejan dos filas; una solicitud sin sesión no crea nada.

### Incremento 4 — Asociar espacios con su propietario

**Objetivo:** cumplir el inicio de RF-01: un usuario registrado puede crear sus propios espacios estadísticos.

**Cambios previstos:**

- Sustituir el arreglo en memoria por persistencia solo cuando la tabla de usuarios exista.
- `POST /api/v1/statistical-spaces` requiere el guard y asigna `ownerId` desde el perfil autenticado, nunca desde `body`.
- `GET /api/v1/statistical-spaces` devuelve únicamente espacios que el usuario puede consultar.
- Las rutas públicas futuras se marcarán explícitamente; no se obtendrán por accidente al omitir un guard.

**Evidencia de cierre:** Alice no puede leer ni crear un espacio a nombre de Bob, y una persona anónima recibe `401` al crear.

### Incremento 5 — Autorización por espacio, no roles globales

**Objetivo:** preparar RF-06 sin mezclar autenticación e identidad con permisos de negocio.

Cuando los espacios sean persistentes, se añadirá una relación de membresía:

```text
space_memberships: spaceId + userId + role
role: owner | editor | analyst | moderator | member
```

Un guard verifica la sesión; una política o servicio de dominio verifica la membresía y la acción concreta. Los roles de Descope pueden servir en el futuro para administradores de plataforma, pero no sustituyen los roles por espacio del producto.

## Qué tomamos del curso y qué adaptamos

La fuente de estudio seleccionada es [167. Crear usuario](</Users/benji/Documents/chrome-extencions/trancripciones/NestJS/NestJS Backend Completo/Sección 13 Autenticación de autorización/167. Crear usuario.md>). Su reconstrucción guiada se guarda junto a la transcripción.

| Del curso | Adaptación para este producto |
| --- | --- |
| Módulo `auth`, controlador, servicio y DTO delimitan responsabilidades | Mantenemos el módulo y el límite HTTP/servicio, pero el primer elemento central es un guard de Descope, no un registro local |
| UUID estable y correo único | Conservamos la idea: `descopeUserId` será la referencia externa inmutable; el correo no será nuestra clave primaria |
| El cliente no elige roles ni estado activo | Conservamos el principio: roles y ownership son decisiones del servidor, ahora por espacio |
| `POST /auth/register` crea una entidad con contraseña | No se copia: Descope registra con Google/Magic Link y Nest no guarda contraseñas |
| Repository y manejo de duplicados | Se adaptará a Turso con SQL parametrizado y restricción única, sin copiar TypeORM |

Lecciones que consultaremos solo cuando cada incremento las necesite:

- **175. Private Route - General**: concepto de proteger rutas. El mecanismo se adaptará a `validateSession`, no a Passport/JWT propio.
- **177. Custom Property Decorator - GetUser**: posible base conceptual para un decorador `@CurrentUser()` después de que el guard esté comprobado.
- **179. Custom Guard y Custom Decorator**: estructura de guard y responsabilidades, sin copiar su estrategia de tokens.
- **180–182**: no se aplican como roles globales; se revisarán al diseñar membresías por espacio.

## Decisiones explícitamente pospuestas

- Login visual personalizado en Astro y SDK Web; primero usaremos un Flow para probar el backend.
- Dominio personalizado, cookies `HttpOnly`, rotación de refresh tokens y configuración de producción.
- Cuenta OAuth propia de Google; la predeterminada de Descope sirve para el prototipo.
- Gestión de usuarios con management keys, invitaciones, SSO, inquilinos, M2M, API keys y agentes/MCP.
- Roles globales de Descope y cualquier autorización antes de que existan espacios persistentes.

## Orden de trabajo inmediato

1. Completar y probar el Flow de Google + Magic Link en Descope.
2. Abrir la guía de la lección 167 y estudiar únicamente su módulo, DTO y criterio de identificador estable; no copiar su contraseña ni registro local.
3. Implementar el Incremento 1: `auth` + validación de sesión + `GET /auth/me` + CORS + petición manual.
4. Ejecutar `pnpm build`, `pnpm lint`, `pnpm format:check` y las cuatro comprobaciones HTTP antes de pasar a persistencia.

El siguiente cambio de código autorizado por este plan es el Incremento 1. Cuando esté comprobado, elegiremos la persistencia antes de crear el perfil local y el propietario de un espacio.
