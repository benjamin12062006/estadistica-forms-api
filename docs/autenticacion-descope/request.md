# Guía de peticiones HTTP

El proyecto usa [httpYac](https://httpyac.github.io/) para ejecutar archivos `.http`
desde la terminal. Las peticiones reutilizables viven en `requests/`.

## Comandos

Seleccionar manualmente una petición:

```bash
pnpm api:request
```

Obtener una sesión temporal de un usuario de prueba de Descope y ejecutar únicamente
la petición autenticada:

```bash
pnpm api:auth-test
```

Este es un comando integral: comprueba o inicia Nest, crea o reutiliza el usuario
tester, genera una sesión temporal y ejecuta httpYac. El procedimiento completo está
documentado en
[`autenticacion-descope/01-prueba-auth-end-to-end.md`](autenticacion-descope/01-prueba-auth-end-to-end.md).

## Secretos

Los archivos `.http`, la documentación y Git nunca deben contener JWT, refresh tokens
ni Management Keys reales. El script guarda la sesión temporal en `requests/.env`,
archivo local ignorado por Git y con permisos restringidos. `requests/auth.http` la
lee mediante `{{$dotenv TEST_SESSION_JWT}}`.

Las credenciales locales se guardan en `.env`, ignorado por Git:

```dotenv
DESCOPE_PROJECT_ID=...
DESCOPE_MANAGEMENT_KEY=...
DESCOPE_TEST_LOGIN_ID=...
```

La Management Key solo pertenece al script local/backend de pruebas. Nunca se expone
en Astro, código cliente, documentación, archivos `.http` ni despliegues públicos.

## Flujo autenticado repetible

```text
Script Node
  → solicita OTP para test user con Management Key
  → verifica OTP o usa Magic Link si Email OTP está deshabilitado
  → comprueba audience y claim tu=true
  → guarda TEST_SESSION_JWT temporalmente en requests/.env
  → httpYac llama GET /api/v1/auth/me
```

Si alguna credencial aparece en una terminal compartida, captura o archivo, debe
revocarse en Descope antes de generar otra.
