# 08 — Sustituir Zod por DTOs de Nest

Fecha de creación: 2026-09-24
Estado: Implementado y verificado
Ámbito: Validación de cuerpos HTTP en usuarios y espacios estadísticos
Relacionada con: [lectura y edición del perfil](./04-leer-y-editar-perfil.md), [espacios del usuario](./05-espacios-del-usuario.md) y [plan de etapas](../../docs/plans/03-etapas-autenticacion-descope-turso.md)

## Necesidad y punto de partida

Las etapas 4 y 5 validaban los cuerpos HTTP con schemas Zod y
`StandardSchemaValidationPipe`. Se pidió adoptar el patrón de DTOs que Fernando
Herrera enseña en Nest y eliminar Zod del proyecto, manteniendo las mismas reglas:

- `displayName`: texto recortado de 1–120 caracteres o `null`.
- `name`: texto recortado de 1–120 caracteres.
- Las propiedades desconocidas deben producir `400`.
- La identidad, el propietario y los atributos administrativos no deben venir del
  body.

## Evidencia e interpretación

Fernando Herrera presenta `ValidationPipe` junto con `class-validator` y
`class-transformer`; los decoradores declaran las restricciones de cada propiedad
[^F1]. En la clase siguiente explica que el pipe puede registrarse globalmente para
que los DTOs se validen antes de llegar al método del controller [^F2].

La adaptación conserva esa separación: el controller recibe un DTO validado y el
service/repository continúa recibiendo datos internos ya confiables. El curso usa
un dominio distinto; no se copia su modelo de tareas ni su persistencia.

## Alternativas y decisión

| Enfoque y fuente                                                            | Supuestos y ventajas para esta necesidad                                                                                                               | Coste o límite                                                        | Decisión y motivo                                                   |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| DTO + `class-validator` + `class-transformer` + `ValidationPipe` [^F1][^F2] | Es el patrón solicitado del curso y se integra directamente con los metadatos de Nest. Permite transformar texto y rechazar propiedades no declaradas. | Añade dos dependencias y decoradores en las clases DTO.               | Elegido para alinear el proyecto con la forma de trabajo estudiada. |
| Schemas Zod + `StandardSchemaValidationPipe`                                | Ya estaba implementado y permitía schemas compactos.                                                                                                   | Ya no representa el patrón que se quiere estudiar en este incremento. | Retirado junto con la dependencia `zod`.                            |

## Implementación y funcionamiento

| Decisión respaldada                           | Archivo y símbolo                                                                                                                                         | Adaptación realizada                                                                                                                       |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Validación declarativa mediante DTO           | [`UpdateProfileDto`](../../src/users/users.dto.ts)                                                                                                        | Reemplaza `updateProfileSchema`; recorta `displayName`, permite `null` y valida tipo, contenido y longitud.                                |
| Validación declarativa mediante DTO           | [`CreateSpaceDto`](../../src/statistical-spaces/statistical-spaces.dto.ts)                                                                                | Reemplaza `createSpaceSchema`; recorta `name` y valida tipo, contenido y longitud.                                                         |
| Pipe global para todos los cuerpos DTO        | [`main.ts`](../../src/main.ts)                                                                                                                            | Usa `ValidationPipe` con `transform`, `whitelist` y `forbidNonWhitelisted`.                                                                |
| DTO como metadato de ejecución del controller | [`UsersController`](../../src/users/users.controller.ts) y [`StatisticalSpacesController`](../../src/statistical-spaces/statistical-spaces.controller.ts) | `@Body()` recibe las clases DTO; se mantienen imports normales en los controllers para que Nest conserve el metadato de tipo.              |
| Eliminación de Zod                            | [`package.json`](../../package.json)                                                                                                                      | Se eliminó `zod` y se añadieron `class-validator` y `class-transformer`. Los archivos `*.validation.ts` fueron sustituidos por `*.dto.ts`. |

El flujo final es:

```text
JSON HTTP → ValidationPipe global → DTO transformado y validado
         → Controller → Service → Repository
```

El `ValidationPipe` transforma los strings antes de validarlos, elimina o rechaza
propiedades no declaradas según `whitelist` y `forbidNonWhitelisted`, y devuelve un
`400` si el body no cumple el DTO.

## Comprobación

| Comando o prueba ejecutada         | Resultado observado                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm build`                       | Terminó correctamente.                                                               |
| `pnpm users:verify`                | 8 pruebas pasan; se validan recorte, límites, `null` y rechazo de propiedades extra. |
| `pnpm spaces:verify`               | 5 pruebas pasan; se validan recorte, límites, rechazo de `ownerId` y wiring de DTOs. |
| `pnpm lint`                        | 0 advertencias y 0 errores.                                                          |
| Búsqueda de imports Zod en `src/`  | No quedan usos de Zod ni de `StandardSchemaValidationPipe`.                          |
| Diagnósticos de controllers y DTOs | Sin errores ni advertencias.                                                         |

No se ejecutó todavía una petición HTTP con un `sessionJwt` real contra Turso
remoto; esta migración solo cambia la validación del body y no modifica la
autenticación ni la persistencia.

## Consecuencias y continuidad

La API ya usa el patrón DTO + `ValidationPipe` de Nest para los cuerpos actuales y
la dependencia Zod fue eliminada. Los DTOs pertenecen al límite HTTP; no se
introdujo validación duplicada en los repositories.

Si aparecen nuevos cuerpos HTTP, se añadirá un DTO específico con sus decoradores.
La siguiente prueba manual pendiente continúa siendo el recorrido Descope → guard →
controller → Turso con una sesión real.

## Fuentes

[^F1]: [48. ValidationPipe - Class Validator y Class Transformer](</Users/benji/Documents/chrome-extencions/trancripciones/NestJS/NestJS Backend Completo/Sección 4 DTOs y Validación de información/48. ValidationPipe - Class Validator y Class Transformer.md>). Instructor: Fernando Herrera. Curso: _NestJS Backend Completo_. Sección 4: DTOs y Validación de información. Ruta relativa a la biblioteca: `NestJS/NestJS Backend Completo/Sección 4 DTOs y Validación de información/48. ValidationPipe - Class Validator y Class Transformer.md`. Localizador: líneas 13–33. Consulta: 2026-09-24.

[^F2]: [49. Pipes Globales - A nivel de Aplicación](</Users/benji/Documents/chrome-extencions/trancripciones/NestJS/NestJS Backend Completo/Sección 4 DTOs y Validación de información/49. Pipes Globales - A nivel de Aplicación.md>). Instructor: Fernando Herrera. Curso: _NestJS Backend Completo_. Sección 4: DTOs y Validación de información. Ruta relativa a la biblioteca: `NestJS/NestJS Backend Completo/Sección 4 DTOs y Validación de información/49. Pipes Globales - A nivel de Aplicación.md`. Localizador: líneas 13–31. Consulta: 2026-09-24.
