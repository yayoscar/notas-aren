# Notas de Aren

Sistema de gestión de inventario, ventas y crédito para perfumería.
Next.js 14 (App Router) + TypeScript + Supabase.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local     # y rellena los valores
npm run dev                    # http://localhost:3000
```

---

## Desarrollo local con base de datos propia

La app puede apuntar a la Supabase de producción o a un stack de Supabase que
corre en tu máquina con Docker. Se alterna con **una sola variable**.

### El interruptor

En `.env.local`:

```bash
NEXT_PUBLIC_APP_ENV=local        # local | production
```

| Valor | Base de datos | Variables que usa |
| --- | --- | --- |
| `local` | Stack local en Docker | `NEXT_PUBLIC_SUPABASE_URL_LOCAL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY_LOCAL`, `SUPABASE_SERVICE_ROLE_KEY_LOCAL` |
| `production`, o sin definir | Proyecto en supabase.co | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

Las variables de producción conservan sus nombres de siempre, así que **el
deploy no necesita ningún cambio**: si `NEXT_PUBLIC_APP_ENV` no existe, la app
se comporta igual que antes.

> Cambiar `.env.local` exige **reiniciar `npm run dev`**: Next.js sustituye las
> variables `NEXT_PUBLIC_*` en tiempo de compilación.

Toda la resolución vive en `src/lib/supabase/env.ts` (y `env.server.ts` para la
service role key). Ningún otro archivo lee esas variables directamente.

### Señales de en qué base estás

- Una píldora fija abajo a la izquierda: verde **BD LOCAL**, roja **⚠ BD PRODUCCIÓN**.
  No aparece en el deploy real.
- La restauración de respaldos (`/configuracion/respaldo`) responde **403** si la
  ejecutas desde tu máquina apuntando a producción. Generar respaldos sí está
  permitido: es como obtienes el ZIP para probar en local.

### Levantar la base local

```bash
npm run db:start      # arranca el stack en Docker (la primera vez tarda)
npm run db:status     # imprime las URLs y las llaves
npm run db:studio     # Supabase Studio en http://127.0.0.1:54323
npm run db:stop       # apaga el stack
npm run db:reset      # rehace el esquema desde supabase/migrations + seed.sql
```

Copia `ANON_KEY` y `SERVICE_ROLE_KEY` de `npm run db:status` a las variables
`*_LOCAL` de `.env.local`.

Puertos: API `54321`, base `54322`, Studio `54323`, correo de prueba `54324`.

### Poblar la base local

Hay dos caminos, y sirven para cosas distintas.

#### 1. Copia fiel de producción (recomendado)

```bash
npm run db:pull-prod
```

Reconstruye el esquema desde las migraciones y carga los datos con `pg_dump`.
Incluye `auth.users`, así que **entras en local con tu usuario y contraseña
reales**. Producción sólo se lee.

Requiere `PROD_DB_URL` en `.env.local`, con la cadena del **Session pooler**:

> Dashboard → Project Settings → Database → Connection string → **Session pooler**
>
> ```text
> postgresql://postgres.<ref>:<PWD>@aws-0-<region>.pooler.supabase.com:5432/postgres
> ```

No sirve el host directo `db.<ref>.supabase.co` (sólo resuelve por IPv6) ni el
puerto `6543` (transaction mode, incompatible con `pg_dump`).

Opciones: `--skip-reset` (no rehace el esquema), `--keep-dumps` (conserva
`tmp/*.sql`; contienen datos reales de clientes y `tmp/` está en `.gitignore`).

#### 2. Cargar un respaldo `.zip` del propio sistema

```bash
npm run db:load-backup -- ~/Descargas/notas-aren-backup-2026-08-08-1200.zip
```

Es el archivo que descarga `/configuracion/respaldo`. Úsalo cuando no tengas
acceso directo a la base, o para probar el propio módulo de respaldo.

El respaldo **no incluye `auth.users`**, pero cinco columnas tienen FK contra
esa tabla (`vendedores.auth_user_id`, `clientes.usuario_id`,
`entradas.usuario_id`, `stock_movimientos.usuario_id`,
`precios_historico.usuario_id`) y `restore_database` no desactiva los triggers
de las FK. Por eso el script siembra primero `auth.users` con los UUID exactos
del respaldo, y sólo después llama al mismo RPC que usa la app. Todos los
usuarios quedan con la contraseña de `LOCAL_DEV_PASSWORD` y el mismo nombre de
usuario que en producción. El script es reejecutable.

### Comprobar deriva de esquema

```bash
npm run db:check-drift
```

Compara producción con local en **tablas, columnas, restricciones, índices,
triggers, políticas RLS y funciones** (firma más hash del cuerpo). Señala la
deriva en los dos sentidos: lo que producción tiene y el repo no —falta una
migración por escribir— y lo que el repo tiene y producción no —migración sin
desplegar—. Ambos accesos son de sólo lectura.

Comparar sólo columnas no bastaba: así fue como `trg_stock_venta_delete` estuvo
ausente de producción sin que nadie lo notara.

### Desplegar migraciones a producción

**El deploy de Vercel no aplica migraciones.** No hay ningún CI que lo haga: la
base de producción sólo cambia cuando alguien lo ejecuta a mano.

Primero mira qué está pendiente (sólo lectura, no toca nada):

```bash
npm run db:pending-prod
```

Y cuando quieras aplicarlas, de forma deliberada:

```bash
set -a; . ./.env.local; set +a
npx supabase db push --db-url "$PROD_DB_URL"
```

Notas:

- `db push` **no** ejecuta `supabase/seed.sql`, así que el bloque de `GRANT`
  del seed —que sólo existe para el stack local— nunca llega a producción.
- Escribe las migraciones de forma idempotente (`IF NOT EXISTS`,
  `ON CONFLICT DO NOTHING`, `DROP ... IF EXISTS` antes de `CREATE POLICY`).
  Varios objetos se aplicaron a mano en producción antes de quedar
  registrados, y sin guarda el push falla a medias.
- Haz un respaldo desde `/configuracion/respaldo` antes de un push grande.

### Notas sobre el esquema local

`supabase/seed.sql` empieza otorgando permisos de tabla a `anon`,
`authenticated` y `service_role`. Hace falta porque las versiones recientes de
Supabase ya no los conceden automáticamente a las tablas que crean las
migraciones, mientras que el proyecto de producción se creó cuando sí se hacía.
Sin ese bloque la base local devolvería *permission denied* en cada consulta.
Los datos siguen protegidos por RLS (migración `20260316000006_enable_rls.sql`).

`npm run db:reset` borra también `auth.users`: vuelve a ejecutar
`db:pull-prod` o `db:load-backup` después.
