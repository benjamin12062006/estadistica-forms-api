# Arquitectura y código claro

## Decisión

Usaremos un **monolito modular por funcionalidad**, siguiendo la estructura práctica del curso de Fernando Herrera:

```text
HTTP → Controller → Service / caso de uso → repositorio o integración → datos
```

No empezaremos con microservicios, una arquitectura hexagonal completa ni capas globales vacías. Es una API Nest única, dividida por capacidades reales: `auth`, `users`, `statistical-spaces`, después `forms` y `responses`.

## Qué viene de Fernando Herrera

La lección 167 organiza la autenticación como un módulo de Nest y separa:

- **Controller**: recibe HTTP y devuelve la respuesta.
- **DTO**: describe y valida el cuerpo que puede enviar el cliente.
- **Service**: contiene el caso de uso y reglas de aplicación.
- **Repository**: delimita la persistencia. En el curso usa TypeORM; en este proyecto
  se adaptará a un repositorio pequeño sobre Turso y SQL parametrizado.

Es arquitectura modular en capas, no Clean Architecture/hexagonal estricta. Conservaremos ese enfoque porque coincide con el estado y el tamaño actual del proyecto.

## Adaptación para Descope

Descope reemplaza solo la parte de credenciales y emisión de sesión:

```text
Descope Flow → session JWT → AuthGuard de Nest → Controller → Service
```

- El `AuthGuard` valida el token de Descope y deja la identidad validada en la petición.
- Los controllers no leen ni validan JWT directamente.
- Los services deciden qué puede hacer esa identidad en el producto.
- La base de datos guardará perfiles, espacios y membresías; nunca contraseñas ni refresh tokens.

## Estructura que construiremos gradualmente

```text
src/
├── app.module.ts
├── main.ts
├── auth/                         # primero: validación de sesión Descope
│   ├── auth.module.ts
│   ├── descope.client.ts
│   ├── descope-session.guard.ts
│   ├── current-user.decorator.ts  # solo cuando el guard esté probado
│   └── auth.controller.ts         # GET /auth/me de comprobación
├── users/                        # cuando exista persistencia
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── users.repository.ts       # se añadirá al aprovisionar perfiles en la etapa 3
├── statistical-spaces/
│   ├── statistical-spaces.module.ts
│   ├── statistical-spaces.controller.ts
│   ├── statistical-spaces.service.ts
│   └── statistical-spaces.repository.ts # cuando migre a Turso
└── forms/                        # solo cuando iniciemos RF-02
```

Los archivos aparecen cuando el incremento los exige. Por ejemplo, no crearemos `common/`, interfaces de repositorio ni entidades de usuarios hasta que haya una base de datos y un caso de uso que las necesite.

## Reglas de código claro

1. Un módulo representa una capacidad del producto, no una tecnología.
2. Un controller traduce HTTP; no contiene reglas de negocio ni acceso directo a base de datos.
3. Un service expresa un caso de uso: crear espacio, aprovisionar perfil, publicar formulario.
4. Un DTO acepta solo datos que el cliente puede decidir. El servidor determina identidad, propietario y rol.
5. El guard autentica; la autorización por espacio vive en un servicio o política propia, no en botones del frontend.
6. Usamos nombres de dominio: `StatisticalSpace`, `ownerId`, `descopeUserId`; evitamos nombres genéricos como `data` o `manager` cuando oculten intención.
7. Una ruta pública se marca explícitamente. Una operación protegida valida sesión en el backend siempre.
8. Cada incremento compila, pasa lint/formato y tiene una petición HTTP manual antes del siguiente.

## Evolución prevista

| Momento | Arquitectura suficiente |
| --- | --- |
| Ahora | módulos Nest + controller/service + almacenamiento en memoria |
| Sesiones | `auth` con guard de Descope; sin tabla de usuarios |
| Persistencia | repositorios por módulo y adaptador de Turso Cloud |
| Espacios compartidos | membresías y política de autorización por espacio |
| Crecimiento real | extraer puertos/adaptadores solo si una regla necesita varios proveedores o si la infraestructura empieza a dominar el módulo |

**Resumen:** usaremos el estilo modular y por capas de Fernando, con reglas de código claro. No afirmaremos que es Clean Architecture completa: la introduciremos únicamente si el proyecto demuestra que la necesita.
