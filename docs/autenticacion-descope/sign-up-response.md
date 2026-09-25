# Respuesta de Sign Up or In — referencia sanitizada

Este documento explica qué parte de la respuesta de Descope usa la API. Los valores
reales de `sessionJwt` y `refreshJwt` se retiraron porque son credenciales y no deben
guardarse en documentación, Git ni archivos `.http`.

> La sesión que apareció anteriormente en este archivo debe revocarse en Descope.
> Redactar el archivo evita nuevas exposiciones, pero no invalida una credencial que
> ya pudo haberse copiado.

## Qué recibe Nest

El cliente envía únicamente el JWT de sesión:

```http
Authorization: Bearer <SESSION_JWT>
```

Nest no recibe el `refreshJwt` en una petición normal y no acepta el objeto `user`
del navegador como prueba de identidad. El navegador puede modificar ese JSON; el
JWT de sesión, en cambio, se valida con el SDK de Descope.

## Claims que usa la API después de validar

| Claim | Uso |
| --- | --- |
| `sub` | Identificador estable de la identidad en Descope |
| `iss` | Emisor de la identidad; formará parte de la clave externa local |
| `aud` | Debe coincidir con `DESCOPE_PROJECT_ID` |
| `exp` | Permite rechazar una sesión expirada |
| `email` | Dato opcional de contacto, nunca clave primaria |

## Flujo acordado

```text
1. La persona completa el Flow de Descope.
2. Descope entrega la sesión al cliente.
3. El cliente llama a Nest con Authorization: Bearer <SESSION_JWT>.
4. Nest valida firma, expiración y audiencia con Descope.
5. Nest usa únicamente las claims ya validadas.
6. En una etapa posterior, Nest crea o recupera el perfil local en Turso.
```

La primera etapa termina en el paso 5. Todavía no crea una fila en Turso.
