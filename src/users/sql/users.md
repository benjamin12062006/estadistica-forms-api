# Consultas SQL de usuarios

Este documento explica las consultas de [`users.sql`](./users.sql).

El archivo `users.sql` no se ejecuta como migración ni sustituye a
`users.repository.ts`. El repositorio es la única fuente ejecutable; este SQL
sirve para revisar las sentencias que el repositorio envía a Turso.

## Origen en el proyecto

- Usuarios locales y aprovisionamiento: [`03-aprovisionar-usuario.md`](../../../bitacora-construccion/auth/03-aprovisionar-usuario.md).
- Lectura y edición de perfil: [`04-leer-y-editar-perfil.md`](../../../bitacora-construccion/auth/04-leer-y-editar-perfil.md).

## Seguridad de los parámetros

Cada `?` es un parámetro posicional enviado por separado en `args`. El valor no
se reemplaza como texto dentro del SQL; por eso un valor del cliente no puede
convertirse en sintaxis SQL.

## 1. `provision(identity)`

Crea el usuario local o recupera el existente para la misma identidad.

### Orden de los argumentos

1. ID UUID nuevo.
2. `identity.issuer`.
3. `identity.subject`.
4. `identity.email` o `null`.
5. Fecha actual.
6. Fecha actual.

### Funcionamiento

`ON CONFLICT` se activa si ya existe la pareja única
`(identity_issuer, identity_subject)`. En ese caso no crea otra fila, sino que
ejecuta el `DO UPDATE` sobre la fila existente.

`excluded` representa la fila candidata que se intentó insertar.
`COALESCE(a, b)` devuelve `a` salvo que sea `NULL`; por eso, si el JWT no trae
email, se conserva el email ya registrado (`b`).

`IS NOT` compara correctamente también cuando uno de los valores es `NULL`. El
`CASE` solo renueva `updated_at` si llegó un email distinto.

`RETURNING` evita una segunda consulta `SELECT`: devuelve la fila resultante de
esta misma operación.

## 2. `findByIdentity(identity)`

Busca el perfil local de la identidad validada por Descope.

### Orden de los argumentos

1. `identity.issuer`.
2. `identity.subject`.

Las dos condiciones juntas son necesarias: el email no identifica al usuario
local. Si no hay coincidencia, el repositorio devuelve `null`.

## 3. `updateDisplayName(identity, displayName)`

Edita únicamente un dato propio del producto. Nunca modifica la identidad de
Descope.

### Orden de los argumentos

1. `displayName`.
2. `displayName` para comparar.
3. Fecha actual.
4. `identity.issuer`.
5. `identity.subject`.

`CASE ... END` calcula el nuevo valor de `updated_at` dentro de la misma
sentencia. Si el nombre no cambia, conserva la fecha anterior.

Si no existe la identidad, `UPDATE` no afecta filas y `RETURNING` no devuelve
ninguna. El servicio transforma ese caso en un error `404`.
