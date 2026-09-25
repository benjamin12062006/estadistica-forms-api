# Etapas de autenticación — Descope + Nest + Turso

## Objetivo

Construir la autenticación en incrementos pequeños y verificables. Descope administra
el registro, el inicio de sesión y las sesiones. Nest valida la identidad y aplica las
reglas del producto. Turso guarda únicamente datos propios de la aplicación.

```text
Descope Flow → session JWT → Nest AuthGuard → identidad validada
                                           ↘ Turso (desde la etapa 2)
```

No crearemos endpoints Nest de email/contraseña ni guardaremos contraseñas, JWT o
refresh tokens en Turso.

## Decisión sobre Turso

La base ya creada en Turso Cloud y conectada a Vercel es la persistencia elegida.
La URL configurada para este proyecto empieza con `libsql://`. Por eso usamos
`@libsql/client/web`, que Turso recomienda para una base libSQL remota desplegada en
Vercel. Las credenciales se leen de `TURSO_DATABASE_URL` y
`TURSO_AUTH_TOKEN`.[^T1]

`@tursodatabase/serverless` corresponde a las bases del nuevo motor Turso con URL
`turso://`; no es el cliente de esta base libSQL.[^T1] Tampoco necesitamos las
funciones SQL experimentales para esta tabla inicial.[^T2]

Empezaremos con SQL parametrizado y un adaptador pequeño dentro del módulo. No se
añadirá un ORM hasta que exista una necesidad concreta de migraciones o mapeo que lo
justifique.

## Etapa 1 — Sesión validada, sin base de datos

**Estado:** implementada; pendiente de comprobar `200` con una sesión real del proyecto.

**Entrega:**

- `AuthModule`, proveedor del SDK de Descope y guard de sesión.
- `GET /api/v1/auth/me` protegido.
- Extracción estricta de `Authorization: Bearer <sessionJwt>`.
- Validación de firma, expiración y `audience: DESCOPE_PROJECT_ID` mediante el SDK.
- Identidad mínima normalizada: `subject`, `issuer` y `email` opcional.
- `Authorization` permitido por CORS, `.env.example` y petición manual sin tokens.

**Criterio de cierre:** sin token o con token inválido responde `401`; con un JWT real
del proyecto responde `200`. La prueba `200` necesita una sesión real y nunca se
versiona su token.

## Etapa 2 — Conexión y esquema mínimo de Turso

**Estado:** implementada y verificada el 2026-09-23.

- `@libsql/client/web` conecta la API Nest a la base libSQL remota.
- `TursoService` valida `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` y ejecuta
  `SELECT 1` al iniciar Nest; si falla la conexión, la API no arranca.
- La migración versionada `migrations/001_create_app_users.sql` se aplica mediante
  `pnpm db:migrate`, un comando explícito, no al arrancar cada instancia.
- `schema_migrations` registra la versión aplicada. La migración y su registro se
  ejecutan en una transacción de escritura.
- `(identity_issuer, identity_subject)` tiene una restricción única real.

Modelo inicial previsto:

```sql
app_users (
  id TEXT PRIMARY KEY,
  identity_issuer TEXT NOT NULL,
  identity_subject TEXT NOT NULL,
  email TEXT,
  display_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (identity_issuer, identity_subject)
)
```

No se copiarán credenciales de Vercel al repositorio. Los nombres de variables serán
los mismos localmente y en el despliegue.

Para verificar el esquema sin tocar la base remota, ejecuta `pnpm db:verify`: usa
una base temporal en memoria, aplica dos veces la migración y comprueba inserción,
lectura y rechazo de un duplicado. El 2026-09-23 también se aplicó la migración a
la base remota configurada y se verificó por lectura que el esquema y su versión
están presentes. Ningún usuario de prueba se insertó en la base remota.

## Etapa 3 — Aprovisionamiento idempotente del usuario

**Estado:** implementada y verificada con una base aislada el 2026-09-23;
pendiente de una prueba manual con un `sessionJwt` real contra el despliegue.

- `UsersModule` expone `PUT /api/v1/users/me`, protegido por
  `DescopeSessionGuard`. Responde `200` con `{ "user": { "id", "email",
"displayName", "createdAt", "updatedAt" } }`.
- Solo usa `issuer` y `subject` que el guard extrae de una sesión Descope
  validada. El body no determina identidad, propietario ni rol.
- Un `UPSERT` parametrizado sobre la pareja única crea o recupera una sola fila,
  incluso cuando llegan peticiones concurrentes. Repetir la petición con los
  mismos claims conserva ID y fechas.
- El email del token es un atributo actualizable: si cambia, se modifica sin
  reemplazar la identidad local; si el token no lo incluye, se conserva el
  anterior. `display_name` queda vacío por ahora; su edición segura pertenece
  a la etapa 4.
- `pnpm users:verify` ejecuta la migración en memoria y comprueba repetición,
  cambio de email, separación por emisor/sujeto y concurrencia. La petición
  manual está en `requests/users.http`; requiere un JWT real no versionado.

## Etapa 4 — Lectura y edición segura del perfil

**Estado:** implementada y verificada con una base aislada el 2026-09-23;
pendiente de prueba HTTP con sesión Descope real.

- `GET /api/v1/users/me` devuelve el perfil local de la identidad validada.
  Si todavía no existe, responde `404`; no aprovisiona de forma implícita.
- `PATCH /api/v1/users/me` acepta solo `{ "displayName": string | null }`.
  El texto se recorta y debe tener entre 1 y 120 caracteres; `null` lo borra.
- Los DTOs con `class-validator` y el `ValidationPipe` global responden `400`
  ante campos adicionales como `email`, `identitySubject`, propietario o rol.
  El cliente no puede modificar la identidad ni otros atributos administrativos.
- `pnpm users:verify` comprueba lectura aislada, edición propia, perfil ausente
  y validación de cuerpos, además de las pruebas de la etapa 3.

## Etapa 5 — Espacios pertenecientes al usuario

**Estado:** implementada y verificada con base aislada el 2026-09-23;
pendiente de aplicar migraciones `002`/`003` al entorno remoto elegido y de prueba
HTTP con sesión real.

- `GET` y `POST /api/v1/statistical-spaces` requieren
  `DescopeSessionGuard` y un perfil local previamente aprovisionado.
- El `owner_id` se asigna desde `app_users.id` resuelto con la identidad
  validada; nunca llega desde el body. `CreateSpaceDto` y el `ValidationPipe`
  rechazan `ownerId` y cualquier otro campo extra. `name` se recorta y debe
  medir 1–120 caracteres.
- El arreglo en memoria se sustituyó por `StatisticalSpacesRepository` y
  `migrations/002_create_statistical_spaces.sql` más un índice de propietario
  en `003_index_statistical_spaces_owner.sql`. El listado usa
  `WHERE owner_id = ?`, por lo que ahora cada usuario ve solo sus espacios.
- `pnpm spaces:verify` comprueba esquema, persistencia, aislamiento Alice/Bob,
  perfil ausente, validación y wiring de controladores/guards con una base
  aislada. No crea registros en Turso remoto.

## Etapa 6 — Ciclo de sesión y endurecimiento

**Estado:** pendiente.

- Integrar el Flow/SDK en Astro para iniciar, refrescar y cerrar sesión.
- Decidir almacenamiento de sesión para producción y política de cookies/orígenes.
- Añadir autorización por membresía de espacio y pruebas de aislamiento.
- Evaluar introspección solo si necesitamos claims revocables en tiempo real.

## Regla para avanzar

Cada etapa deja una bitácora en `bitacora-construccion/auth/` con fuentes,
decisiones y resultados reales. Las comprobaciones pendientes de la etapa 1 se
mantienen visibles hasta ejecutarlas; la etapa 2 se inició por petición expresa.

## Fuentes

[^T1]: Turso, _Vercel_, sección “SQL over HTTP”, https://docs.turso.tech/integrations/vercel; y _Turso Quickstart (TypeScript)_, sección “Remote libSQL database”, https://docs.turso.tech/sdk/ts/quickstart. Consulta: 2026-09-23.

[^T2]: Turso, _Experimental Features_, secciones “Experimental Features List” y “JavaScript / Node.js SDK”, https://docs.turso.tech/sql-reference/experimental-features. Consulta: 2026-09-23.
