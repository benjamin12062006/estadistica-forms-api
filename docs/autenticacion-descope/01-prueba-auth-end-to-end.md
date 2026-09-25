# Prueba de autenticación Descope de extremo a extremo

Esta guía conserva el procedimiento local para probar `GET /api/v1/auth/me`
sin copiar JWT en Git, archivos `.http` o documentación.

## Resultado esperado

Un solo comando realiza todo el proceso:

```bash
pnpm api:auth-test
```

El comando:

1. Carga la configuración privada desde `.env`.
2. Comprueba si Nest ya responde en `127.0.0.1:8080`.
3. Si Nest no está activo, compila el proyecto, inicia `dist/main.js` y espera hasta
   que la API responda.
4. Confirma que `/api/v1/auth/me` sin sesión devuelve `401`.
5. Busca el usuario de prueba configurado en Descope.
6. Si no existe, lo crea mediante el SDK de administración. Si el mismo login ID
   pertenece a un usuario normal, detiene la prueba para no modificar esa cuenta.
7. Solicita y verifica un OTP especial para usuarios de prueba. Si Email OTP está
   deshabilitado, usa automáticamente un Magic Link de prueba.
8. Valida la firma, audiencia y el claim `tu: true` del `sessionJwt`.
9. Guarda el JWT temporal en `requests/.env`, con permisos restringidos y fuera de
   Git, para permitir peticiones manuales posteriores.
10. Ejecuta con httpYac la petición `authenticated` de `requests/auth.http`.
11. Elimina la copia en memoria, conserva `requests/.env` para pruebas manuales y
    detiene Nest si el propio script lo inició.

Si Nest ya estaba ejecutándose, el script lo reutiliza y no lo detiene.

## Configuración local

Crea `.env` a partir de `.env.example` y completa estos valores:

```dotenv
DESCOPE_PROJECT_ID=...
DESCOPE_MANAGEMENT_KEY=...
DESCOPE_TEST_LOGIN_ID=auth-api-test@example.test
```

- `DESCOPE_PROJECT_ID`: identificador del proyecto y audiencia esperada del JWT.
- `DESCOPE_MANAGEMENT_KEY`: clave privada para administrar usuarios de prueba.
- `DESCOPE_TEST_LOGIN_ID`: correo exclusivo para pruebas automatizadas. No debe ser
  el correo de una cuenta real ni de un usuario normal de Descope.

La Management Key necesita permisos de **User Testing** para el proyecto. Si tiene
una lista de IP permitidas, la IP pública desde la que se ejecuta el comando debe
estar incluida. El script local prioriza IPv4 para que Descope reciba la misma IPv4
configurada en `Permitted IPs`, incluso cuando la Mac también tenga conectividad IPv6.
El script usa exclusivamente las operaciones de test users, por lo que no necesita
el permiso más amplio de administración general de usuarios.

## Dónde se guarda `TEST_SESSION_JWT`

La siguiente expresión de `requests/auth.http`:

```http
Authorization: Bearer {{$dotenv TEST_SESSION_JWT}}
```

lee `TEST_SESSION_JWT` desde el archivo dotenv situado junto a la petición. El
script genera automáticamente `requests/.env` con permisos `0600`.

No se guarda en el `.env` principal ni dentro de `auth.http`. El archivo local
`requests/.env` está ignorado por Git. Aun así, el token:

- es secreto;
- expira;
- puede revocarse;
- solo sirve hasta su expiración o revocación.

Después de ejecutar `pnpm api:auth-test`, se puede volver a enviar `auth.http`
manualmente mientras el JWT siga vigente. Si expira, se vuelve a ejecutar el comando
para reemplazarlo.

## Archivos participantes

```text
package.json
  └─ api:auth-test

scripts/descope/run-auth-request.mts
  ├─ prepara o reutiliza Nest
  ├─ crea o reutiliza el usuario tester
  ├─ obtiene y valida la sesión temporal
  ├─ guarda el JWT temporal en requests/.env
  └─ ejecuta httpYac

requests/auth.http
  └─ contiene las peticiones sin secretos
```

## Salida correcta

Una ejecución satisfactoria debe terminar con mensajes equivalentes a estos:

```text
API Nest detectada o iniciada. Respuesta sin sesión verificada (HTTP 401).
Usuario de prueba creado correctamente.
Sesión de prueba validada. Ejecutando GET /api/v1/auth/me…
Prueba autenticada completada correctamente (HTTP 2xx).
```

En ejecuciones posteriores, el usuario se reutiliza en lugar de volver a crearse.

## Errores frecuentes

### `E023017 — Access key not allowed by IP`

La Management Key restringe las IP de origen. Agrega la IP pública actual a
**Descope Console → Company → Management Keys → Permitted IPs** y vuelve a
ejecutar el comando.

### El login ID pertenece a un usuario normal

Cambia `DESCOPE_TEST_LOGIN_ID` por un correo exclusivo para automatización. El
script no convierte ni reemplaza usuarios normales.

### La API no responde

Comprueba que el puerto `8080` esté libre. El comando compila e inicia Nest por sí
solo cuando no encuentra una API activa.

## Reglas de seguridad

- Nunca imprimir ni documentar la Management Key, OTP o JWT.
- Nunca agregar `TEST_SESSION_JWT` a `.env.example` ni al `.env` principal.
- Nunca colocar un Bearer token literal en `requests/auth.http`.
- Revocar de inmediato cualquier sesión o clave que haya sido expuesta.
- Usar estas credenciales solamente en desarrollo local.
