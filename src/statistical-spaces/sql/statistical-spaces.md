# Consultas SQL de espacios estadísticos

Este documento explica las consultas de
[`statistical-spaces.sql`](./statistical-spaces.sql).

El archivo `statistical-spaces.sql` no se ejecuta como migración ni sustituye a
`statistical-spaces.repository.ts`. El repositorio es la única fuente
ejecutable; este SQL sirve para revisar las sentencias que el repositorio envía
a Turso.

## Origen en el proyecto

- Pertenencia y aislamiento de espacios:
  [`05-espacios-del-usuario.md`](../../../bitacora-construccion/auth/05-espacios-del-usuario.md).

## Seguridad de los parámetros

Cada `?` es un parámetro posicional enviado por separado en `args`. Los valores
nunca se interpolan dentro del texto SQL.

## 1. `findAllByOwner(ownerId)`

Lista únicamente los espacios cuyo `owner_id` pertenece al usuario local.

### Orden de los argumentos

1. `ownerId`.

`WHERE` es la regla de aislamiento: sin ella, una persona podría recibir
espacios de otra. `ORDER BY created_at DESC` muestra primero el espacio más
reciente.

`id DESC` decide de forma estable el orden si dos espacios comparten fecha.

## 2. `create(ownerId, name)`

Crea un espacio únicamente si su propietario local todavía existe.

### Orden de los argumentos

1. UUID del espacio.
2. `name`.
3. Fecha actual.
4. `ownerId`.

`INSERT ... SELECT` inserta el espacio a partir de la fila de `app_users` que
coincide con `ownerId`. No recibe `owner_id` directamente como dato de entrada:
toma el `id` de la fila encontrada.

Si no existe ese usuario, `SELECT` no produce filas, `INSERT` no inserta nada y
`RETURNING` queda vacío. El repositorio convierte ese resultado en un error
`404`.

`RETURNING` devuelve el espacio creado sin ejecutar un `SELECT` posterior.
