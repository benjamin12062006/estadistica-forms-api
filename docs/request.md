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

La API debe estar ejecutándose en otra terminal:

```bash
pnpm start:dev
```

## Secretos

Los archivos `.http`, la documentación y Git nunca deben contener JWT, refresh tokens
ni Management Keys reales. `requests/auth.http` lee `TEST_SESSION_JWT` exclusivamente
del entorno del proceso que crea el script de prueba.

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
  → verifica OTP con Descope
  → comprueba audience y claim tu=true
  → entrega TEST_SESSION_JWT solo al proceso hijo
  → httpYac llama GET /api/v1/auth/me
```

Si alguna credencial aparece en una terminal compartida, captura o archivo, debe
revocarse en Descope antes de generar otra.
