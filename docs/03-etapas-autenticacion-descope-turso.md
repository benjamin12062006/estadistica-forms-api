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

La base ya creada en Turso Cloud y conectada a Vercel es la persistencia elegida. Para
una API Nest que se conecta por red, la documentación actual recomienda
`@tursodatabase/serverless`; usa `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`.[^T1]

No usaremos por ahora `@tursodatabase/libsql` ni las funciones experimentales. Esa
página documenta banderas para capacidades SQL todavía experimentales y muestra una
base local `file:database.db`; no es el requisito de esta API remota.[^T2]

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

**Estado:** pendiente.

- Instalar `@tursodatabase/serverless`.
- Leer y validar `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` desde el entorno.
- Crear un adaptador de conexión en Nest y una comprobación controlada de conectividad.
- Añadir una migración SQL versionada para `app_users`.
- Definir una restricción única compuesta para `(identity_issuer, identity_subject)`.

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

## Etapa 3 — Aprovisionamiento idempotente del usuario

**Estado:** pendiente.

- Crear el módulo `users` y `PUT /api/v1/users/me`.
- Usar exclusivamente `issuer` y `subject` obtenidos por el guard.
- Crear o recuperar una sola fila aunque la petición se repita.
- Guardar email/nombre solo como atributos actualizables, no como identidad primaria.
- Verificar concurrencia y la restricción única con Turso real o una base aislada.

## Etapa 4 — Lectura y edición segura del perfil

**Estado:** pendiente.

- `GET /api/v1/users/me` devuelve el perfil local.
- La actualización admite únicamente campos propios del producto.
- El cliente nunca elige `identitySubject`, propietario, rol ni estado administrativo.

## Etapa 5 — Espacios pertenecientes al usuario

**Estado:** pendiente.

- Proteger las operaciones de `statistical-spaces`.
- Asignar `ownerId` desde el usuario local autenticado, nunca desde el body.
- Sustituir el arreglo en memoria por Turso mediante el mismo límite de repositorio.

## Etapa 6 — Ciclo de sesión y endurecimiento

**Estado:** pendiente.

- Integrar el Flow/SDK en Astro para iniciar, refrescar y cerrar sesión.
- Decidir almacenamiento de sesión para producción y política de cookies/orígenes.
- Añadir autorización por membresía de espacio y pruebas de aislamiento.
- Evaluar introspección solo si necesitamos claims revocables en tiempo real.

## Regla para avanzar

No se empieza una etapa hasta comprobar la anterior. Cada etapa deja una bitácora en
`bitacora-construccion/auth/` con fuentes, decisiones y resultados reales.

## Fuentes

[^T1]: Turso, *Turso Quickstart (TypeScript)*, sección “Remote Turso database: @tursodatabase/serverless”, https://docs.turso.tech/sdk/ts/quickstart. Consulta: 2026-09-21.
[^T2]: Turso, *Experimental Features*, secciones “Experimental Features List” y “JavaScript / Node.js SDK”, https://docs.turso.tech/sql-reference/experimental-features. Consulta: 2026-09-21.
