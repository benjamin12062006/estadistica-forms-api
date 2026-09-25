# 07 — Consultas SQL de lectura

Fecha de creación: 2026-09-24
Estado: Implementado y verificado
Ámbito: documentación de las consultas de usuarios y espacios
Relacionada con: [aprovisionamiento](./03-aprovisionar-usuario.md), [perfil](./04-leer-y-editar-perfil.md) y [espacios](./05-espacios-del-usuario.md)

## Objetivo

Conservar una vista legible de cada sentencia SQL ejecutada por los repositorios, con el orden de parámetros y las partes de sintaxis que contienen una decisión relevante. Los nuevos archivos son material de lectura: no son migraciones y la aplicación no los ejecuta.

## Procedencia y decisión

| Consulta | Método ejecutable | Decisión documentada |
| --- | --- | --- |
| UPSERT, lectura y edición de usuario | [`UsersRepository`](../../src/users/users.repository.ts) | Las etapas 03 y 04 definen la identidad por `issuer + subject`, la actualización opcional del email y la edición exclusiva de `display_name`. |
| Listado y creación de espacios | [`StatisticalSpacesRepository`](../../src/statistical-spaces/statistical-spaces.repository.ts) | La etapa 05 define `owner_id` como regla de pertenencia y una inserción que solo procede si existe el propietario. |

La lección 167 aporta la separación entre controlador, servicio y repositorio, además de la necesidad de que la base imponga reglas de unicidad.[^F1] La lección 185 muestra pasar el usuario autenticado al caso de creación asociado a ese usuario.[^F2] Ninguna de las dos dicta estas sentencias: `ON CONFLICT`, `COALESCE`, `CASE`, `RETURNING` e `INSERT ... SELECT` son adaptación propia para SQLite/libSQL y Turso, ya explicada en las etapas 03 a 05.

## Archivos añadidos

- [`src/users/users.sql`](../../src/users/users.sql) copia las tres consultas de `UsersRepository`, enumera sus `args` y explica UPSERT, `excluded`, `COALESCE`, comparación con `NULL`, `CASE` y `RETURNING`.
- [`src/statistical-spaces/statistical-spaces.sql`](../../src/statistical-spaces/statistical-spaces.sql) copia las dos consultas de `StatisticalSpacesRepository`, enumera sus `args` y explica aislamiento por `owner_id`, orden determinista e `INSERT ... SELECT`.

Ambos archivos declaran que los `?` son parámetros posicionales enviados aparte por `@libsql/client`; no interpolan valores en el texto SQL. El SQL ejecutable sigue en los repositorios para impedir que una copia documental se convierta en una segunda fuente de comportamiento.

## Comprobación

| Comprobación | Resultado |
| --- | --- |
| Comparación de sentencias y argumentos con ambos repositorios | Las cinco consultas y el orden de sus parámetros coinciden. |
| `pnpm build` | Finalizó correctamente. |
| `node --test test/users-*.test.mjs` | 8 pruebas superadas. |
| `node --test test/statistical-spaces.test.mjs test/route-wiring.test.mjs` | 5 pruebas superadas. |

## Fuentes

[^F1]: [167. Crear usuario](</Users/benji/Documents/chrome-extencions/trancripciones/NestJS/NestJS Backend Completo/Sección 13 Autenticación de autorización/167. Crear usuario.md>). Instructor: Fernando Herrera. Curso: *NestJS Backend Completo*, sección 13. Localizador: líneas 33–41; inyección del repositorio, creación/guardado y tratamiento de una restricción de unicidad. Consulta: 2026-09-24.
[^F2]: [185. Insertar userId en los productos](</Users/benji/Documents/chrome-extencions/trancripciones/NestJS/NestJS Backend Completo/Sección 13 Autenticación de autorización/185. Insertar userId en los productos.md>). Instructor: Fernando Herrera. Curso: *NestJS Backend Completo*, sección 13. Localizador: líneas 13–23; el usuario autenticado llega al caso de creación y queda asociado al registro. Consulta: 2026-09-24.
