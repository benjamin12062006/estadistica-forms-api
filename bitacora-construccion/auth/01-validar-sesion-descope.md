# 01 — Validar una sesión de Descope en Nest

Fecha: 2026-09-21
Estado: Implementado, pendiente de verificación
Ámbito: Autenticación del backend
Relacionada con: `docs/01-plan-autenticacion-descope.md`

## Necesidad y punto de partida

La API todavía no tiene rutas autenticadas. El primer incremento debe aceptar un
`sessionJwt` emitido por Descope, rechazar credenciales ausentes o inválidas y
exponer una sonda protegida `GET /api/v1/auth/me`. En esta etapa no se crea un
usuario local ni se conecta Turso.

El SDK `@descope/node-sdk` ya está instalado. CORS todavía no admite el encabezado
`Authorization` y un documento del proyecto contiene credenciales reales que deben
ser retiradas antes de añadir ejemplos de uso.

## Evidencia e interpretación

En Nest, un guard implementa `canActivate` y decide si una petición puede continuar;
también puede lanzar una excepción que el framework transforma en respuesta HTTP.[^F1]
El curso distingue autenticación de autorización y usa una ruta privada pequeña para
probar la integración antes de añadir más reglas.[^F2]

La documentación de Descope exige recuperar el token de sesión del encabezado
`Authorization`, validarlo en el servidor y pasar explícitamente la audiencia del
proyecto.[^F3] Esto respalda un guard asíncrono y un `401` uniforme, no una validación
en el controller ni confianza en datos enviados por el navegador.

## Alternativas y decisión

| Enfoque y fuente | Supuestos y ventajas para esta necesidad | Coste o límite | Decisión y motivo |
| --- | --- | --- | --- |
| Guard de Nest[^F1] | Centraliza el acceso antes del controller | Hay que normalizar errores del proveedor | Elegido para la frontera HTTP |
| Validación con `validateSession`[^F3] | Comprueba firma, expiración y audiencia con el SDK oficial | Requiere `DESCOPE_PROJECT_ID` y una sesión real para la prueba 200 | Elegido; no se implementará un verificador JWT paralelo |
| Middleware genérico | Puede leer encabezados | Expresa peor la decisión de acceso propia del ciclo de Nest | Descartado en esta etapa |

## Implementación y funcionamiento

El módulo `auth` inicializa el cliente oficial con el Project ID del entorno. El guard
exige un único Bearer token, llama a `validateSession` pasando la audiencia y solo
después construye una identidad interna inmutable. El controller devuelve esa vista
mínima; no recibe perfiles ni identificadores en el body.

| Decisión respaldada | Archivo y símbolo | Adaptación realizada |
| --- | --- | --- |
| Usar un guard para permitir o impedir la ruta[^F1] | `src/auth/descope-session.guard.ts` — `DescopeSessionGuard.canActivate` | Traduce ausencia/formato/validación fallida a `401` y adjunta una identidad validada |
| Validar con audiencia explícita[^F3] | `src/auth/descope.service.ts` — `validateSession` | Usa `DESCOPE_PROJECT_ID` tanto al crear el cliente como al validar `aud` |
| Probar primero una ruta privada pequeña[^F2] | `src/auth/auth.controller.ts` — `getCurrentIdentity` | Añade únicamente `GET /api/v1/auth/me`; no mezcla persistencia ni autorización por roles |
| Transportar el token en `Authorization`[^F3] | `src/main.ts` y `requests/auth.http` | CORS admite el encabezado y el ejemplo contiene solo un marcador |

`src/main.ts` carga `.env` mediante la API nativa de Node cuando el archivo existe;
en Vercel se conservan las variables ya inyectadas por el entorno. Así evitamos una
dependencia adicional solo para este primer incremento.

Antes de implementar se retiraron los JWT reales de `docs/sign-up-response.md`. El
documento conserva únicamente el contrato sanitizado; revocar la sesión expuesta sigue
siendo una acción manual necesaria en Descope.

## Comprobación

| Comando, petición o prueba ejecutada | Resultado observado |
| --- | --- |
| Inventario inicial de código y dependencias | No existe módulo `auth`; `@descope/node-sdk` 2.17.0 ya está declarado |
| `nest build` | Finalizó con código 0 |
| `oxlint --type-aware src/` | Finalizó con código 0, sin diagnósticos |
| `prettier --check "src/**/*.ts"` | Todos los archivos cumplen el formato |
| Inicio con `node dist/main.js` | La API cargó `.env`, inicializó `AuthModule` y publicó la ruta sin mostrar secretos |
| `GET /api/v1/auth/me` sin encabezado | `401 Unauthorized` con contrato Bearer requerido |
| `GET /api/v1/auth/me` con Bearer inválido | `401 Unauthorized` sin filtrar detalles del SDK |
| Preflight desde `http://localhost:4321` solicitando `Authorization` | `204`; `Access-Control-Allow-Headers` incluye `Authorization` |
| Guard con respuesta validada simulada | Normalizó `subject`, `issuer` y `email` correctamente |

No se ejecutó el caso HTTP `200` contra Descope porque no se usó una credencial real
durante la automatización. Para cerrar esa comprobación hace falta iniciar la API con
el Project ID real y enviar un `sessionJwt` nuevo sin guardarlo en el repositorio.

## Consecuencias y continuidad

La API ya diferencia una petición anónima o inválida de una identidad que el SDK
acepta y limita la respuesta a claims necesarias. La persistencia idempotente del
perfil queda fuera de este cambio y se implementará en la etapa siguiente con Turso
Cloud. Esta entrada pasará a “Implementado y verificado” cuando se observe el `200`
con una sesión real del proyecto.

## Fuentes

[^F1]: *179. Custom Guard y Custom Decorator*. Instructor: Fernando Herrera. Curso: *NestJS Backend Completo*. Sección 13: Autenticación de autorización. Archivo: `179. Custom Guard y Custom Decorator.md`. Ruta: `/Users/benji/Documents/chrome-extencions/trancripciones/NestJS/NestJS Backend Completo/Sección 13 Autenticación de autorización/`. Localizador: líneas 21–29. Consulta: 2026-09-21.
[^F2]: *175. Private Route - General*. Instructor: Fernando Herrera. Curso: *NestJS Backend Completo*. Sección 13: Autenticación de autorización. Archivo: `175. Private Route - General.md`. Misma ruta de sección. Localizador: líneas 13–25. Consulta: 2026-09-21.
[^F3]: Descope, *Node.js Backend SDK Integration*, secciones “Import and Setup Backend SDK” e “Implement Session Validation”, https://docs.descope.com/getting-started/nodejs. Consulta: 2026-09-21.
