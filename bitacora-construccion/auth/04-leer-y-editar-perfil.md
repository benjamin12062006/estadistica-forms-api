# 04 — Leer y editar el perfil local

Fecha: 2026-09-23
Última actualización: 2026-09-24
Estado: Implementado y verificado con base aislada
Ámbito: perfil del usuario autenticado
Relacionada con: [etapa 3](./03-aprovisionar-usuario.md) y [plan](../../docs/plans/03-etapas-autenticacion-descope-turso.md)

## Necesidad y evidencia

La etapa 4 requiere leer el perfil propio y editar solo campos del producto. Fernando Herrera muestra que la validación del DTO pertenece al límite HTTP y que incluso una actualización parcial necesita validar sus propiedades.[^F1] La implementación actual sigue ese patrón con `class-validator`, `class-transformer` y el `ValidationPipe` global.

Adaptación: `GET /users/me` buscará por `issuer` y `subject` validados; `PATCH /users/me` aceptará únicamente `displayName` (texto de 1–120 caracteres o `null` para borrarlo). No se aceptarán email, rol, estado, ID ni identidad externa del cliente. Un usuario autenticado sin perfil local recibirá `404` hasta ejecutar el aprovisionamiento de la etapa 3.

## Implementación

| Decisión                                          | Código                                                                                                       | Comportamiento                                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Buscar y actualizar solo la identidad autenticada | [`UsersRepository`](../../src/users/users.repository.ts)                                                     | `SELECT` y `UPDATE` parametrizados por `identity_issuer` y `identity_subject`; no hay ID en la ruta ni en el body. |
| Perfil ausente explícito                          | [`UsersService`](../../src/users/users.service.ts)                                                           | `GET` y `PATCH` devuelven `404` si no hubo aprovisionamiento previo.                                               |
| Allowlist de edición                              | [`UpdateProfileDto`](../../src/users/users.dto.ts), [`UsersController`](../../src/users/users.controller.ts) | Solo `displayName`; los decoradores del DTO y `forbidNonWhitelisted` rechazan campos desconocidos.                 |
| Validación en límite HTTP                         | [`main.ts`](../../src/main.ts)                                                                               | `ValidationPipe` transforma y valida los DTOs declarados en `@Body`.                                               |

`displayName` es dato propio del producto. `email` continúa viniendo de las claims del token durante el aprovisionamiento, no de esta edición. Esta selección es una decisión del proyecto, no una copia del DTO del curso.

## Comprobación

| Prueba ejecutada    | Resultado observado                                                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm users:verify` | 8 pruebas pasan: cuatro de aprovisionamiento y cuatro de perfil; se probó aislamiento Alice/Bob, ausencia `404`, cambio/borrado del nombre y rechazo `400` de campos prohibidos con el pipe real de Nest. |
| `pnpm lint`         | Código de salida 0.                                                                                                                                                                                       |

La base usada en esas pruebas es libSQL en memoria. No se escribió en Turso remoto ni se probó aún `GET/PATCH` con una sesión Descope real. La etapa 5 puede reutilizar `UsersService.findCurrent` para exigir un propietario local existente.

## Fuentes

[^F1]: [48. ValidationPipe - Class Validator y Class Transformer](</Users/benji/Documents/chrome-extencions/trancripciones/NestJS/NestJS Backend Completo/Sección 4 DTOs y Validación de información/48. ValidationPipe - Class Validator y Class Transformer.md>). Instructor: Fernando Herrera. Curso: _NestJS Backend Completo_. Sección 4: DTOs y Validación de información. Ruta relativa a la biblioteca: `NestJS/NestJS Backend Completo/Sección 4 DTOs y Validación de información/48. ValidationPipe - Class Validator y Class Transformer.md`. Localizador: líneas 13–19 y 27–33. Consulta: 2026-09-23.

[^F2]: NestJS, _Validation_, sección “Schema-based validation”, https://docs.nestjs.com/application/validation. Consulta: 2026-09-23.

[^F3]: Zod, _Defining schemas_, sección “z.strictObject”, https://zod.dev/api. Consulta: 2026-09-23.
