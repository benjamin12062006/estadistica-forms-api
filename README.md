# estadistica-forms-api

Backend de formularios, estadísticas e investigación, construido paso a paso con **NestJS + TypeScript + pnpm**. Los incrementos actuales ofrecen una ruta de comprobación y el inicio del dominio de espacios estadísticos.

## Incrementos actuales: saludo y espacios estadísticos

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

### Comprobar la ruta

```bash
curl -i http://127.0.0.1:8080/api/v1/hello-world
```

Resultado: `200 OK`, `Content-Type: application/json` y:

```json
{"message":"Hello, world!"}
```

`GET` consulta; `/api` identifica la API; `/v1` identifica su contrato; `/hello-world` nombra esta demostración. La versión de la URL es independiente de `package.json` y de los tags de Git. Un cambio compatible no exige crear `/v2`.

La raíz `/` no tiene un controlador y responde `404`, al igual que una ruta desconocida. Además del saludo, la API permite crear y listar espacios estadísticos mientras se ejecuta localmente:

```bash
curl -i -X POST http://127.0.0.1:8080/api/v1/statistical-spaces \
  -H 'Content-Type: application/json' \
  --data '{"name":"Satisfacción de usuarios"}'

curl -i http://127.0.0.1:8080/api/v1/statistical-spaces
```

`POST /api/v1/statistical-spaces` recibe un JSON con `name`, elimina espacios exteriores y rechaza nombres vacíos o de más de 120 caracteres con `400 Bad Request`. `GET /api/v1/statistical-spaces` devuelve los espacios creados desde que la API se inició. Por ahora viven solo en memoria: se pierden al detenerla y todavía no tienen propietario, autenticación, archivo ni permisos.

### Consumirla desde el frontend

Desde JavaScript ejecutado en el navegador, tanto en Astro como en Next.js:

```js
const response = await fetch('http://127.0.0.1:8080/api/v1/hello-world');
if (!response.ok) throw new Error(`La API respondió ${response.status}`);
const data = await response.json();
console.log(data.message);
```

CORS permite los orígenes locales `http://localhost:4321`, `http://127.0.0.1:4321` (Astro), `http://localhost:3000` y `http://127.0.0.1:3000` (Next.js). Si el frontend utiliza otro puerto, ajusta `origin` en `src/main.ts`. CORS permite al navegador leer respuestas entre orígenes distintos; no autentica usuarios ni impide solicitudes de otros clientes HTTP.

Para inspeccionar los encabezados:

```bash
curl -i http://127.0.0.1:8080/api/v1/hello-world \
  -H 'Origin: http://localhost:4321'

curl -i -X OPTIONS http://127.0.0.1:8080/api/v1/hello-world \
  -H 'Origin: http://localhost:3000' \
  -H 'Access-Control-Request-Method: POST'
```

El segundo comando debe responder `204` y permitir ese origen. El frontend todavía no está conectado visualmente: ese será el siguiente incremento.

## Cómo está organizado ahora

```text
src/
├── main.ts
├── app.module.ts
├── statistical-spaces/
│   ├── statistical-spaces.module.ts
│   ├── statistical-spaces.controller.ts
│   └── statistical-spaces.service.ts
└── hello-world/
    ├── hello-world.module.ts
    └── hello-world.controller.ts
```

El recorrido para espacios estadísticos es `main.ts → AppModule → StatisticalSpacesModule → StatisticalSpacesController → StatisticalSpacesService → JSON`.

- `main.ts` crea la aplicación, configura prefijo, versión, CORS y puerto.
- `AppModule` reúne los módulos de la aplicación.
- `StatisticalSpacesModule` agrupa la funcionalidad de espacios y registra controlador y servicio.
- `StatisticalSpacesController` declara `@Controller('statistical-spaces')`, recibe las peticiones HTTP y delega el trabajo.
- `StatisticalSpacesService` valida el nombre y mantiene temporalmente los espacios en memoria.
- `HelloWorldModule` y `HelloWorldController` se conservan como ruta de comprobación mínima.

El servicio de espacios permite aprender y verificar el límite entre HTTP y reglas de negocio sin decidir todavía persistencia. Mantendremos módulos por funcionalidad, por ejemplo `forms` y `auth`, a medida que sean necesarios.

**Dirección de crecimiento:** un monolito modular con controladores para HTTP, servicios para las reglas y acceso a datos separado cuando incorporemos persistencia. Las integraciones de análisis, IA y PDF tendrán límites claros cuando se implementen. Esa dirección no exige crear hoy carpetas, repositorios ni interfaces vacías.

## Cursos seleccionados y fuentes

La referencia principal es **Fernando Herrera**. Esta selección se basa en el temario publicado y en las transcripciones disponibles en la biblioteca local, no en afirmar que existe un único curso universalmente mejor.

| Prioridad | Curso y nombre en la biblioteca | Aplicación en este proyecto |
| --- | --- | --- |
| Principal | [Nest: Desarrollo backend escalable con Node](https://www.udemy.com/course/nest-framework/) — `NestJS Backend Completo` | Fundamentos, TypeScript, REST, módulos, servicios, DTOs, validación, Docker, MongoDB, PostgreSQL, TypeORM, autenticación, autorización, OpenAPI, WebSockets y despliegue. Es el curso con la descripción que elegiste. |
| Complemento de calidad | [NestJS + Testing: Pruebas unitarias y end to end (e2e)](https://www.udemy.com/course/nestjs-testing-e2e/) — `Testing en NestJS` | Pruebas de reglas, errores, permisos, controladores y flujo HTTP conforme crezca el sistema. |
| Complemento de informes | [NestJs + Reportes: Genera PDFs desde Node](https://www.udemy.com/course/nestjs-reportes/) — `Reportes PDF con NestJS` | Documentos, tablas y gráficos cuando tengamos resultados que exportar. |

Los tres cursos seleccionados son de Fernando Herrera/DevTalles. No hace falta terminarlos todos antes de construir: consultaremos las clases que resuelvan el incremento actual.

También se revisó `NestJS API Profesional` ([NestJS Mastery: Build & Deploy a Production-Ready API](https://www.udemy.com/course/master-nestjs-the-javascript-nodejs-framework/)). Es una segunda referencia opcional para contrastar organización, pruebas y autorización, no una sustitución de Fernando. Su biblioteca incluye secciones marcadas `OLDER CONTENT`, que no se usarán como configuración vigente.

`Microservicios con NestJS` queda para una necesidad real de distribución. El primer producto se construirá como un solo backend modular. MongoDB y PostgreSQL se estudian en el curso principal, pero eso no implica instalar ambos: elegiremos la persistencia cuando definamos los datos. TypeORM con PostgreSQL es la referencia inicial a evaluar para proyectos, formularios y respuestas.

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

**Adaptación propia:** pnpm, Nest 12.0.3, el nombre del proyecto, `/api/v1/hello-world`, `/api/v1/statistical-spaces`, el almacenamiento temporal en memoria, puerto 8080 y orígenes de Astro/Next.js. La configuración ESM y las importaciones `.js` provienen del CLI actual; no deben reemplazarse mecánicamente por las de una grabación anterior.

La base generada se mantiene reducida a los archivos necesarios para el saludo y los espacios en memoria. Las herramientas de pruebas se incorporarán con el primer comportamiento que requiera pruebas de regresión; hoy comprobamos compilación, lint, formato y solicitudes HTTP reales. El curso de Testing utiliza Jest: su configuración se adaptará a las versiones vigentes al incorporar esas pruebas.

Para compatibilidad actual se contrastaron las [instrucciones oficiales de inicio](https://docs.nestjs.com/first-steps), [versionado de rutas](https://docs.nestjs.com/techniques/versioning) y [CORS](https://docs.nestjs.com/security/cors). La versión se consultó con `pnpm view @nestjs/core version` y se fijó en `package.json`.

## Método de trabajo

Este proyecto aplica [construir-desde-cursos](</Users/benji/.agents/skills/construir-desde-cursos/SKILL.md>) y [filosofia-de-trabajo](</Users/benji/.agents/skills/filosofia-de-trabajo/SKILL.md>):

1. Leer el estado actual de los archivos y definir un incremento observable.
2. Consultar primero la clase pertinente de Fernando y explicar el concepto.
3. Adaptarlo a nuestro problema, distinguiendo la fuente de nuestras decisiones.
4. Implementar únicamente las piezas necesarias.
5. Verificar el resultado antes de añadir el siguiente escalón.

El objetivo futuro es una plataforma de formularios y resultados compartidos para educación e investigación. El orden orientativo es: saludo HTTP → espacio estadístico en memoria → primer formulario y validación → persistencia → usuarios y permisos → análisis e informes → colaboración. Se ajustará según las necesidades reales.

Comprobaciones disponibles:

```bash
pnpm build
pnpm lint
pnpm format:check
```

Después se comprueban las rutas, la validación y CORS con los comandos anteriores o [requests/statistical-spaces.http](./requests/statistical-spaces.http). Este incremento no implementa todavía formularios, base de datos, autenticación, propietarios, archivo, WebSockets ni informes.
