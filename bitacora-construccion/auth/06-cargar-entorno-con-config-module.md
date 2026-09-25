# 06 — Cargar el entorno con ConfigModule

Fecha: 2026-09-23
Estado: Implementado y verificado
Ámbito: configuración de la API Nest
Relacionada con: [etapa 1](./01-validar-sesion-descope.md) y [etapa 5](./05-espacios-del-usuario.md)

## Necesidad y punto de partida

La aplicación ya completó las etapas 1–5 y Descope, Turso y el puerto consumen
variables desde `process.env`. Desde la etapa 1, `main.ts` carga `.env` directamente
con `node:process.loadEnvFile()`. El cambio solicitado es delegar esa responsabilidad
al módulo oficial de configuración de Nest sin modificar los contratos de auth,
usuarios, espacios ni persistencia.

## Evidencia e interpretación

Fernando Herrera muestra que el archivo `.env` no aparece por sí solo en
`process.env`: instala `@nestjs/config`, registra `ConfigModule.forRoot()` al inicio de
los imports de `AppModule` y entonces Nest carga las variables.[^F1] La clase siguiente
advierte que el orden importa cuando otros módulos leen la configuración al arrancar.[^F2]

La documentación actual de Nest confirma que `forRoot()` lee `.env` desde la raíz,
lo combina con el entorno del proceso y conserva la precedencia de las variables
inyectadas por la plataforma. También permite declarar el módulo global para no
reimportarlo en cada feature.[^F3]

## Alternativas y decisión

| Enfoque | Coste o límite | Decisión |
| --- | --- | --- |
| Mantener `loadEnvFile()` en `main.ts` | Funciona, pero deja la carga fuera del sistema de módulos de Nest | Sustituido por la dependencia solicitada |
| `ConfigModule.forRoot()` global | Añade una dependencia oficial y centraliza la carga antes de los módulos de dominio | Elegido; se colocará primero en `AppModule` |
| Migrar ahora todos los accesos a `ConfigService` | Cambiaría constructores y pruebas de Descope/Turso; excede este ajuste | Pospuesto para otro incremento si aporta valor |

## Implementación y funcionamiento

Se añadió `@nestjs/config` 12.0.1, alineado con Nest 12 del proyecto. `AppModule`
registra `ConfigModule.forRoot({ isGlobal: true })` como primer import. De este modo,
la configuración se resuelve antes de inicializar `AuthModule` y `TursoModule`, cuyos
servicios actuales siguen leyendo `process.env` y conservan sus validaciones.

`main.ts` ya no importa ni ejecuta `loadEnvFile()`: existe una sola responsabilidad
para cargar `.env`. Si Vercel ya inyectó una variable, esa variable del proceso tiene
prioridad sobre el valor local, conforme al comportamiento documentado.[^F3]

| Decisión respaldada | Código | Adaptación realizada |
| --- | --- | --- |
| Registrar el módulo al inicio[^F1][^F2] | [`AppModule`](../../src/app.module.ts) | `ConfigModule.forRoot()` es el primer import dinámico para que las dependencias lean el entorno resuelto |
| Hacer disponible la configuración en toda la aplicación[^F3] | [`AppModule`](../../src/app.module.ts) | Se usa `isGlobal: true`; no se repite `ConfigModule` en auth, database o users |
| Eliminar el segundo cargador | [`main.ts`](../../src/main.ts) | Se retiró `node:process.loadEnvFile()` y su manejo manual de `ENOENT` |

No se inyectó `ConfigService` en Descope o Turso. El curso lo presenta como el paso
siguiente para providers,[^F2] pero hacerlo ahora ampliaría constructores, dobles de
prueba y validaciones sin ser necesario para centralizar la carga solicitada.

## Comprobación

| Comprobación ejecutada | Resultado observado |
| --- | --- |
| `pnpm build` | Código de salida 0 |
| `pnpm lint` | Código de salida 0 |
| Prettier sobre `src/app.module.ts` y `src/main.ts` | Ambos archivos cumplen el formato |
| Importar `dist/app.module.js` tras retirar `DESCOPE_PROJECT_ID` del proceso | `ConfigModule` volvió a cargar la variable desde `.env`; no se imprimió su valor |
| `node --test test/*.test.mjs` | 13 pruebas pasan; usuarios, perfiles, espacios, aislamiento y wiring permanecen operativos |
| `pnpm db:verify` | Las tres migraciones siguen siendo repetibles y la identidad única se conserva |

La comprobación de carga no inicializó conexiones remotas ni mostró secretos. Las
pruebas de dominio usan bases aisladas en memoria.

## Consecuencias y continuidad

El comportamiento permanece igual: `.env` sirve para desarrollo y las variables
inyectadas por Vercel conservan prioridad. Esta entrada sustituye únicamente el
mecanismo manual documentado en la etapa 1. No añade validación global ni cambia
secretos, conexiones o endpoints. Si más adelante se adopta `ConfigService`, deberá
hacerse en otro incremento con pruebas de los errores de configuración de Descope y
Turso.

## Fuentes

[^F1]: [103. Configuración de variables de entorno](</Users/benji/Documents/chrome-extencions/trancripciones/NestJS/NestJS Backend Completo/Sección 9 Variables de entorno - Deployment y Dockerizar la aplicación/103. Configuración de variables de entorno.md>). Instructor: Fernando Herrera. Curso: *NestJS Backend Completo*. Sección 9: Variables de entorno - Deployment y Dockerizar la aplicación. Ruta relativa a la biblioteca: `NestJS/NestJS Backend Completo/Sección 9 Variables de entorno - Deployment y Dockerizar la aplicación/103. Configuración de variables de entorno.md`. Localizador: líneas 23–29. Consulta: 2026-09-23.
[^F2]: [104. Configuration Loader](</Users/benji/Documents/chrome-extencions/trancripciones/NestJS/NestJS Backend Completo/Sección 9 Variables de entorno - Deployment y Dockerizar la aplicación/104. Configuration Loader.md>). Instructor: Fernando Herrera. Mismo curso y sección. Ruta relativa a la biblioteca: `NestJS/NestJS Backend Completo/Sección 9 Variables de entorno - Deployment y Dockerizar la aplicación/104. Configuration Loader.md`. Localizador: líneas 13–15. Consulta: 2026-09-23.
[^F3]: NestJS, *Configuration*, secciones “Getting started” y “Use module globally”, https://docs.nestjs.com/techniques/configuration. Consulta: 2026-09-23.
