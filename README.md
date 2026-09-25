# estadistica-forms-api

Backend de formularios, estadísticas e investigación, construido paso a paso con **NestJS + TypeScript + pnpm**. Ya dispone de identidad validada, perfil local y espacios privados persistidos.

Las [etapas de autenticación](./docs/plans/03-etapas-autenticacion-descope-turso.md)
validan sesiones con Descope y guardan perfiles y espacios en SQLite local. Configura
`DATABASE_URL=file:./.data/estadistica-dev.db` en `.env` y ejecuta
`pnpm db:local:migrate` antes de usar las rutas persistentes. `prisma/migrations`
es la única fuente activa de cambios; las pruebas crean bases SQLite temporales y
aplican sobre ellas esa misma historia.

Para crear un cambio de esquema se usa `pnpm db:local:migration:create -- --name nombre`. La misma migración se despliega localmente con `pnpm db:local:migrate` y en Turso con `pnpm db:turso:migrate`; ambos destinos consumen `prisma/migrations`.

## Incrementos actuales: sesión, perfil y espacios propios

### Requisitos e inicio

- Node.js **24.15 o superior dentro de la rama 24 LTS**; `.nvmrc` fija **24.19.0**, la versión utilizada para verificar este proyecto. También se admite Node 26 o superior.
- pnpm **12.5.1**, registrado en `packageManager`.
- NestJS **12.0.3**, última versión estable consultada en npm el **19 de septiembre de 2026**. `pnpm-lock.yaml` fija las dependencias resueltas.

Si usas nvm, ejecuta `nvm install` y `nvm use` dentro de esta carpeta. Después:

```bash
pnpm install --frozen-lockfile
pnpm start:dev
```

`start:dev` recompila y reinicia la API al guardar archivos. Para iniciarla sin observación, usa `pnpm start`. Para ejecutar el resultado compilado:

```bash
pnpm build
pnpm start:prod
```

La API escucha localmente en `127.0.0.1:8080`. Se puede cambiar el puerto con `PORT=8081 pnpm start:dev`. La configuración actual está pensada para desarrollo local; el despliegue se abordará en otro incremento.

**Nota sobre este equipo:** el Node predeterminado encontrado era 24.2.0, inferior al requerido por los generadores actuales. La comprobación se hizo con Node 24.19.0 disponible en el runtime de Codex, sin cambiar la instalación global. Usa la versión de `.nvmrc` para trabajar desde tu terminal.

### Comprobar la sesión y los espacios

```bash
curl -i http://127.0.0.1:8080/api/v1/auth/me
```

Sin sesión, responde `401 Unauthorized`. Con un `sessionJwt` válido del proyecto,
`GET /api/v1/auth/me` responde `200` con la identidad validada. No copies el token
en archivos versionados.

`GET` consulta; `/api` identifica la API y `/v1` identifica su contrato. La versión
de la URL es independiente de `package.json` y de los tags de Git. Un cambio
compatible no exige crear `/v2`.

La raíz `/` no tiene un controlador y responde `404`, al igual que una ruta desconocida. Con un `sessionJwt` temporal de Descope, aprovisiona primero el perfil local y después crea y lista espacios:

```bash
curl -i -X PUT http://127.0.0.1:8080/api/v1/users/me \
  -H "Authorization: Bearer $TEST_SESSION_JWT"

curl -i -X POST http://127.0.0.1:8080/api/v1/statistical-spaces \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TEST_SESSION_JWT" \
  --data '{"name":"Satisfacción de usuarios"}'

curl -i http://127.0.0.1:8080/api/v1/statistical-spaces \
  -H "Authorization: Bearer $TEST_SESSION_JWT"
```

`GET /api/v1/users/me` lee el perfil y `PATCH /api/v1/users/me` permite cambiar únicamente `displayName`. `POST /api/v1/statistical-spaces` recibe solo `name` (1–120 caracteres tras recortar espacios); `GET /api/v1/statistical-spaces` devuelve únicamente los espacios del usuario autenticado. Todas estas rutas requieren sesión. El propietario se determina en el backend, nunca en el cuerpo. Si el perfil local no existe todavía, `GET`, `PATCH` y las rutas de espacios devuelven `404`: primero ejecuta `PUT /users/me`.

Las pruebas de estas etapas despliegan las migraciones Prisma sobre bases SQLite temporales. La base local existente se incorporó mediante baseline, sin volver a crear sus tablas ni borrar datos.

### Consumirla desde el frontend

Desde JavaScript ejecutado en el navegador, tanto en Astro como en Next.js, una
petición protegida deberá incluir el JWT de sesión que proporcione Descope:

```js
const response = await fetch('http://127.0.0.1:8080/api/v1/users/me', {
  headers: { Authorization: `Bearer ${sessionJwt}` },
});
if (!response.ok) throw new Error(`La API respondió ${response.status}`);
const data = await response.json();
console.log(data.user);
```

CORS permite los orígenes locales `http://localhost:4321`, `http://127.0.0.1:4321` (Astro), `http://localhost:3000` y `http://127.0.0.1:3000` (Next.js). Si el frontend utiliza otro puerto, ajusta `origin` en `src/main.ts`. CORS permite al navegador leer respuestas entre orígenes distintos; no autentica usuarios ni impide solicitudes de otros clientes HTTP.

Para inspeccionar los encabezados:

```bash
curl -i http://127.0.0.1:8080/api/v1/auth/me \
  -H 'Origin: http://localhost:4321'

curl -i -X OPTIONS http://127.0.0.1:8080/api/v1/auth/me \
  -H 'Origin: http://localhost:3000' \
  -H 'Access-Control-Request-Method: POST'
```

El segundo comando debe responder `204` y permitir ese origen. El frontend todavía no está conectado visualmente: ese será el siguiente incremento.

## Cómo está organizado ahora

```text
src/
├── main.ts
├── app.module.ts
├── auth/
├── database/
├── users/
└── statistical-spaces/
│   ├── statistical-spaces.module.ts
│   ├── statistical-spaces.controller.ts
│   ├── statistical-spaces.service.ts
│   └── statistical-spaces.repository.ts
```

El recorrido para espacios estadísticos es `guard de Descope → controller → servicio → usuario local → repositorio → Prisma → SQLite`.

- `main.ts` crea la aplicación, configura prefijo, versión, CORS y puerto.
- `AppModule` reúne los módulos de la aplicación.
- `StatisticalSpacesModule` agrupa la funcionalidad de espacios y registra controlador y servicio.
- `StatisticalSpacesController` declara `@Controller('statistical-spaces')`, recibe las peticiones HTTP y delega el trabajo.
- Los DTOs y el `ValidationPipe` global validan el cuerpo al entrar; `StatisticalSpacesService` resuelve al usuario local y `StatisticalSpacesRepository` consulta SQLite mediante `$queryRaw` parametrizado de Prisma, filtrando por propietario.

Seguimos con módulos por funcionalidad. Los perfiles y espacios ya son persistentes; formularios, membresías y permisos compartidos vendrán en etapas posteriores.

**Dirección de crecimiento:** un monolito modular con controladores para HTTP, servicios para las reglas y acceso a datos separado cuando incorporemos persistencia. Las integraciones de análisis, IA y PDF tendrán límites claros cuando se implementen. Esa dirección no exige crear hoy carpetas, repositorios ni interfaces vacías.

## Cursos seleccionados y fuentes

La referencia principal es **Fernando Herrera**. Esta selección se basa en el temario publicado y en las transcripciones disponibles en la biblioteca local, no en afirmar que existe un único curso universalmente mejor.

| Prioridad               | Curso y nombre en la biblioteca                                                                                                  | Aplicación en este proyecto                                                                                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Principal               | [Nest: Desarrollo backend escalable con Node](https://www.udemy.com/course/nest-framework/) — `NestJS Backend Completo`          | Fundamentos, TypeScript, REST, módulos, servicios, DTOs, validación, Docker, MongoDB, PostgreSQL, TypeORM, autenticación, autorización, OpenAPI, WebSockets y despliegue. Es el curso con la descripción que elegiste. |
| Complemento de calidad  | [NestJS + Testing: Pruebas unitarias y end to end (e2e)](https://www.udemy.com/course/nestjs-testing-e2e/) — `Testing en NestJS` | Pruebas de reglas, errores, permisos, controladores y flujo HTTP conforme crezca el sistema.                                                                                                                           |
| Complemento de informes | [NestJs + Reportes: Genera PDFs desde Node](https://www.udemy.com/course/nestjs-reportes/) — `Reportes PDF con NestJS`           | Documentos, tablas y gráficos cuando tengamos resultados que exportar.                                                                                                                                                 |

Los tres cursos seleccionados son de Fernando Herrera/DevTalles. No hace falta terminarlos todos antes de construir: consultaremos las clases que resuelvan el incremento actual.

También se revisó `NestJS API Profesional` ([NestJS Mastery: Build & Deploy a Production-Ready API](https://www.udemy.com/course/master-nestjs-the-javascript-nodejs-framework/)). Es una segunda referencia opcional para contrastar organización, pruebas y autorización, no una sustitución de Fernando. Su biblioteca incluye secciones marcadas `OLDER CONTENT`, que no se usarán como configuración vigente.

`Microservicios con NestJS` queda para una necesidad real de distribución. El primer producto se construye como un solo backend modular. MongoDB, PostgreSQL y TypeORM se estudian en el curso principal, pero la persistencia activa elegida para este proyecto es Prisma con SQLite local y SQL parametrizado.

Estos cursos respaldan el backend y los informes. El análisis estadístico, la integración con IA y el uso de Polars requieren fuentes específicas adicionales cuando lleguemos a esa etapa.

### Transcripciones consultadas para este incremento

Biblioteca: `/Users/benji/Documents/chrome-extencions/trancripciones/NestJS`.

- [30. Generar nuestro primer proyecto - CarDealership](</Users/benji/Documents/chrome-extencions/trancripciones/NestJS/NestJS Backend Completo/Sección 3 Primeros pasos en Nest/30. Generar nuestro primer proyecto - CarDealership.md>): CLI, gestor de paquetes y ejecución en desarrollo.
- [31. Explicación de cada archivo y directorio](</Users/benji/Documents/chrome-extencions/trancripciones/NestJS/NestJS Backend Completo/Sección 3 Primeros pasos en Nest/31. Explicación de cada archivo y directorio.md>): responsabilidades de los archivos iniciales.
- [32. Módulos](</Users/benji/Documents/chrome-extencions/trancripciones/NestJS/NestJS Backend Completo/Sección 3 Primeros pasos en Nest/32. Módulos.md>): agrupar funcionalidades y partir de una base pequeña.
- [33. Controladores](</Users/benji/Documents/chrome-extencions/trancripciones/NestJS/NestJS Backend Completo/Sección 3 Primeros pasos en Nest/33. Controladores.md>): módulo por funcionalidad, rutas con decoradores y respuesta HTTP.
- [36. Servicios](</Users/benji/Documents/chrome-extencions/trancripciones/NestJS/NestJS Backend Completo/Sección 3 Primeros pasos en Nest/36. Servicios.md>): separar lógica reutilizable e inyectarla cuando sea necesaria.

Para seleccionar los complementos se consultaron [Testing: introducción a pruebas de módulos, controladores y servicios](</Users/benji/Documents/chrome-extencions/trancripciones/NestJS/Testing en NestJS/Sección 4 Pruebas sobre módulos, controladores y servicios/22. Introducción.md>) y [Reportes: demostración del objetivo](</Users/benji/Documents/chrome-extencions/trancripciones/NestJS/Reportes PDF con NestJS/Sección 2 Preparación de proyecto/7. Demostración del objetivo.md>). La segunda prepara datos con Prisma; aprovechar sus enseñanzas sobre PDF no obliga a cambiar el ORM de este proyecto.

### Qué procede del curso y qué adaptamos

**Del curso:** CLI oficial, TypeScript, Express como adaptador inicial, módulos por funcionalidad, controladores con decoradores, separación posterior de servicios y desarrollo incremental.

**Adaptación propia:** pnpm, Nest 12.0.3, el nombre del proyecto, rutas `/api/v1`, Descope, Prisma con SQLite local, DTOs con `class-validator` y `class-transformer`, puerto 8080 y orígenes de Astro/Next.js. La configuración ESM y las importaciones `.js` provienen del CLI actual; no deben reemplazarse mecánicamente por las de una grabación anterior.

Las etapas 3–5 cuentan con pruebas automatizadas usando el runner integrado de Node y bases SQLite temporales migradas por Prisma. El curso de Testing utiliza Jest; no se incorporó solo para replicar su configuración.

Para compatibilidad actual se contrastaron las [instrucciones oficiales de inicio](https://docs.nestjs.com/first-steps), [versionado de rutas](https://docs.nestjs.com/techniques/versioning) y [CORS](https://docs.nestjs.com/security/cors). La versión se consultó con `pnpm view @nestjs/core version` y se fijó en `package.json`.

## Método de trabajo

Este proyecto aplica [construir-desde-cursos](/Users/benji/.agents/skills/construir-desde-cursos/SKILL.md) y [filosofia-de-trabajo](/Users/benji/.agents/skills/filosofia-de-trabajo/SKILL.md):

1. Leer el estado actual de los archivos y definir un incremento observable.
2. Consultar primero la clase pertinente de Fernando y explicar el concepto.
3. Adaptarlo a nuestro problema, distinguiendo la fuente de nuestras decisiones.
4. Implementar únicamente las piezas necesarias.
5. Verificar el resultado antes de añadir el siguiente escalón.

El objetivo futuro es una plataforma de formularios y resultados compartidos para educación e investigación. Ya existen perfiles y espacios privados; el siguiente escalón de autenticación es el ciclo de sesión en Astro y después vendrán membresías, formularios, análisis e informes.

Comprobaciones disponibles:

```bash
pnpm build
pnpm lint
pnpm format:check
pnpm db:verify
pnpm users:verify
pnpm spaces:verify
```

Las peticiones manuales están en [requests/users.http](./requests/users.http) y [requests/statistical-spaces.http](./requests/statistical-spaces.http); requieren un JWT real no versionado. Aquí no se completó un recorrido HTTP real de estas etapas, ya que el entorno de prueba no permitió abrir un puerto local. Tampoco se implementaron todavía formularios, membresías, archivo, WebSockets ni informes.
