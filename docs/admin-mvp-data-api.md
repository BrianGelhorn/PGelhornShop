# Diseño MVP: catálogo administrable

## Decisión

Usar **Supabase** como backend alojado: Postgres para los productos, Auth para una cuenta administradora y Storage para sus fotos. La API de datos será la REST que Supabase genera para PostgREST, consumida con `@supabase/supabase-js`; no crear un servidor propio.

La tienda seguirá cerrando pedidos por WhatsApp. No se guardan pedidos ni pagos en esta versión.

## Modelo de datos

Una tabla pública `products`:

| Campo | Tipo | Regla | Uso |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | ID estable usado por `/producto/:id` y el carrito |
| `name` | `text` | requerido, 1–120 caracteres | Nombre visible |
| `category` | `text` | requerido, no vacío | Categoría; los filtros se derivan de los productos activos |
| `description` | `text` | requerido, default `''`, máximo 1000 | Descripción de detalle y alt de foto |
| `price` | `numeric(12,2)` | requerido, `>= 0` | Precio en ARS; la moneda sigue en configuración de tienda |
| `image_path` | `text` | nullable | Ruta de foto en el bucket `product-images` |
| `in_stock` | `boolean` | requerido, default `true` | Muestra disponibilidad; no representa unidades exactas |
| `is_active` | `boolean` | requerido, default `true` | `false` oculta el producto sin borrarlo |
| `created_at` | `timestamptz` | requerido, default `now()` | Orden inicial del catálogo |

No crear tabla `categories` ni inventario por unidades todavía. Categoría como texto coincide con el modelo existente; la interfaz puede ofrecer sugerencias de categorías ya usadas. `in_stock` basta para el MVP mientras WhatsApp confirma disponibilidad.

### SQL inicial

```sql
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  category text not null check (char_length(trim(category)) between 1 and 60),
  description text not null default '' check (char_length(description) <= 1000),
  price numeric(12, 2) not null check (price >= 0),
  image_path text,
  in_stock boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index products_active_created_idx
  on public.products (created_at desc)
  where is_active = true;

alter table public.products enable row level security;
grant select on public.products to anon, authenticated;
grant insert, update on public.products to authenticated;

create policy "Public reads active products; admins read all"
  on public.products for select to anon, authenticated
  using (
    is_active
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "Admins create products"
  on public.products for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins update products"
  on public.products for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

No delete grant or policy: archivar con `is_active = false` es reversible y no rompe enlaces ni vacía carritos ya guardados.

## Admin y autorización

- Crear manualmente una cuenta de administrador en Supabase Auth; no habilitar registro público.
- Deshabilitar `signUp` desde los ajustes de Auth; el dashboard solo ofrece inicio de sesión.
- Asignar `app_metadata.role = 'admin'` mediante un mecanismo de servidor confiable (Dashboard/Admin API), nunca desde el cliente ni en `user_metadata`.
- La interfaz `/admin` requiere sesión; las políticas RLS son la autorización real y protegen también si alguien llama a la API directamente.
- No incluir la `service_role` key en Vite, HTML ni variables `VITE_*`. El cliente solo recibe Project URL y anon/publishable key; la protección depende de RLS.

## Fotos en Storage

- Permitir `INSERT`, `UPDATE` y `DELETE` de objetos del bucket únicamente a sesiones con `app_metadata.role = 'admin'`.
- Crear políticas sobre `storage.objects` limitadas a `bucket_id = 'product-images'`; el bucket público no hace públicas las escrituras.
- En el cliente, obtener la URL pública con `supabase.storage.from('product-images').getPublicUrl(image_path)`.
- El cliente genera un UUID para el producto, sube la foto a una ruta única bajo ese UUID y luego guarda `image_path` junto con la fila. Si falla el guardado, intenta borrar la foto recién subida; si falla limpiar la foto anterior, la fila sigue válida y queda un objeto huérfano no referenciado.

### Bucket y políticas

```sql
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

create policy "Public reads product images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-images');

create policy "Admins upload product images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "Admins replace product images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'product-images'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    bucket_id = 'product-images'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "Admins remove product images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
```

## Contrato de API

Usar el SDK de Supabase para llamar a PostgREST/Storage. Los nombres siguientes describen operaciones; la API REST generada aplica RLS en todas.

Base URL: `{SUPABASE_URL}`. Supabase JS añade `apikey` y la sesión añade `Authorization: Bearer <JWT>`.

| Método | Ruta | Acceso |
|---|---|---|
| `GET` | `/rest/v1/products?select=*&is_active=eq.true&order=created_at.desc` | Público |
| `GET` | `/rest/v1/products?select=*&id=eq.{uuid}&is_active=eq.true` | Público |
| `POST` | `/rest/v1/products` | Admin |
| `PATCH` | `/rest/v1/products?id=eq.{uuid}` | Admin |
| `POST` | `/storage/v1/object/product-images/{uuid}/{filename}` | Admin; enviar `x-upsert: true` al reemplazar |
| `DELETE` | `/storage/v1/object/product-images/{path}` | Admin; borrar foto antigua después de guardar la nueva |

El JSON de producto usa los nombres de columna (`name`, `category`, `description`, `price`, `image_path`, `in_stock`, `is_active`). No se expone endpoint para borrar filas: se archivan con `PATCH` a `is_active = false`.

| Operación | Consulta SDK aproximada | Permiso |
|---|---|---|
| Listar catálogo | `from('products').select(...).eq('is_active', true).order('created_at', { ascending: false })` | Público |
| Abrir detalle | `from('products').select(...).eq('id', id).eq('is_active', true).maybeSingle()` | Público |
| Crear producto | `from('products').insert(product).select().single()` | Admin |
| Editar precio, texto o stock | `from('products').update(fields).eq('id', id).select().single()` | Admin |
| Ocultar/restaurar | `from('products').update({ is_active: false/true }).eq('id', id)` | Admin |
| Subir foto | `storage.from('product-images').upload(path, file, { upsert: true })` | Admin |
| Iniciar/cerrar sesión | `auth.signInWithPassword(...)` / `auth.signOut()` | Público / sesión |

Para el frontend se adapta snake_case a `Product` existente: `in_stock → inStock`, `image_path → image` (URL pública). `price` permanece numérico para `Intl.NumberFormat` y el mensaje de WhatsApp.

Errores que la UI debe mostrar sin perder el formulario: sesión vencida/401, permisos insuficientes/403, validación de precio o nombre y fallo de carga de imagen. Nunca mostrar éxito hasta confirmar la escritura.

## Variables de entorno del frontend

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Ambas son públicas por diseño; RLS, Auth y Storage policies deben estar activas antes de cargar datos reales. La clave `service_role` queda solo en un entorno servidor y no se necesita para este MVP.

## Estado en el repositorio

La implementación del cliente, la ruta `/admin`, la carga pública del catálogo y la migración SQL están en el código. No hay todavía un proyecto Supabase enlazado ni credenciales, así que el frontend muestra un estado de configuración hasta conectar uno.

## Puesta en marcha

1. Crear un proyecto Supabase y aplicar `supabase/migrations/202609230001_products.sql` desde SQL Editor o Supabase CLI.
2. En Auth, deshabilitar el registro público y crear el usuario administrador.
3. Copiar el UUID de ese usuario y asignar el rol usando el Admin API desde una terminal confiable. El script `scripts/set-admin-role.mjs` requiere `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en variables de entorno y el UUID como argumento. No guardar ni pegar la service role key en el frontend, `.env.local` ni Git.
4. Copiar `.env.example` a `.env.local` y completar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
5. Reiniciar Vite y abrir `/admin`; cerrar y volver a iniciar sesión después de cambiar `app_metadata` para renovar el JWT.
6. Probar anónimo: catálogo y fotos visibles, escrituras denegadas. Probar admin: crear, editar, ocultar/restaurar productos y reemplazar foto. Verificar que se ve el cambio desde una segunda sesión.
7. Probar el pedido por WhatsApp tras configurar el número del negocio.

Fuera del MVP: tabla de órdenes, pagos, cuentas de clientes, roles múltiples, unidades de inventario y categorías gestionables por separado. La configuración real de Supabase y las pruebas RLS contra el proyecto quedan pendientes hasta tener acceso al proyecto y sus credenciales.
