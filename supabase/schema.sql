-- =====================================================================
-- WORK SHOP · Sistema de gestión
-- Esquema de base de datos (Supabase / Postgres)
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar todo → Run.
-- Se puede correr una sola vez sobre un proyecto nuevo.
-- =====================================================================

-- ---------- Tipos ----------
create type moneda as enum ('USD', 'ARS');
create type rol_usuario as enum ('admin', 'vendedor');
create type tipo_comprobante as enum (
  'presupuesto',      -- no mueve stock ni cuenta corriente
  'pedido',           -- reserva: no mueve stock ni cuenta corriente
  'venta',            -- baja stock, suma deuda al cliente
  'nc_venta',         -- devolución de cliente: sube stock, resta deuda
  'compra',           -- sube stock, suma deuda con proveedor
  'nc_compra'         -- devolución a proveedor: baja stock, resta deuda
);
create type estado_comprobante as enum ('abierto', 'confirmado', 'anulado');
create type tipo_mov_stock as enum ('compra', 'venta', 'nc_venta', 'nc_compra', 'ajuste');

-- ---------- Usuarios y roles ----------
create table perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol rol_usuario not null default 'vendedor',
  activo boolean not null default true,
  creado timestamptz not null default now()
);

-- Al crear un usuario en Supabase Auth se crea su perfil (vendedor por defecto).
create function crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function crear_perfil();

create function es_equipo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and activo);
$$;

create function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and activo and rol = 'admin');
$$;

-- ---------- Configuración ----------
create table cotizaciones (
  id bigint generated always as identity primary key,
  fecha date not null default current_date unique,
  usd_ars numeric(14,2) not null check (usd_ars > 0)
);

create table depositos (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  activo boolean not null default true
);
insert into depositos (nombre) values ('Central');

-- Listas de precios: margen % sobre costo, o precio cargado a mano.
create table listas_precios (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  margen_pct numeric(6,2),          -- null = precios cargados a mano
  activa boolean not null default true,
  orden int not null default 0
);
insert into listas_precios (nombre, margen_pct, orden) values
  ('Mayorista', 5, 1), ('VIP', 3, 2), ('Minorista', 15, 3);

-- ---------- Productos ----------
create table marcas (
  id bigint generated always as identity primary key,
  nombre text not null unique
);

create table categorias (
  id bigint generated always as identity primary key,
  nombre text not null unique
);
insert into categorias (nombre) values ('Celulares'), ('Tablets'), ('Accesorios'), ('Consolas');

create table productos (
  id bigint generated always as identity primary key,
  codigo text unique,
  codigo_barras text,
  nombre text not null,
  marca_id bigint references marcas(id),
  categoria_id bigint references categorias(id),
  costo_usd numeric(12,2) not null default 0,   -- solo visible para el equipo
  stock_minimo int not null default 0,
  activo boolean not null default true,
  notas text,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index productos_nombre_idx on productos using gin (to_tsvector('simple', nombre));

-- Precio manual por lista (solo para listas sin margen o para pisar el cálculo)
create table precios (
  producto_id bigint not null references productos(id) on delete cascade,
  lista_id bigint not null references listas_precios(id) on delete cascade,
  precio_usd numeric(12,2) not null check (precio_usd >= 0),
  actualizado timestamptz not null default now(),
  primary key (producto_id, lista_id)
);

-- Historial de costos (para ver evolución y margen real)
create table historial_costos (
  id bigint generated always as identity primary key,
  producto_id bigint not null references productos(id) on delete cascade,
  costo_usd numeric(12,2) not null,
  fecha timestamptz not null default now(),
  origen text  -- 'manual', 'compra #123', 'import'
);

-- ---------- Terceros ----------
create table clientes (
  id bigint generated always as identity primary key,
  nombre text not null,
  razon_social text,
  cuit text,
  telefono text,
  email text,
  direccion text,
  localidad text,
  lista_id bigint references listas_precios(id),
  vendedor_id uuid references perfiles(id),
  limite_credito_usd numeric(12,2),
  habilitado boolean not null default true,
  notas text,
  creado timestamptz not null default now()
);

create table proveedores (
  id bigint generated always as identity primary key,
  nombre text not null,
  razon_social text,
  cuit text,
  telefono text,
  email text,
  direccion text,
  notas text,
  activo boolean not null default true,
  creado timestamptz not null default now()
);

-- ---------- Comprobantes ----------
create table comprobantes (
  id bigint generated always as identity primary key,
  tipo tipo_comprobante not null,
  numero int not null,
  fecha date not null default current_date,
  cliente_id bigint references clientes(id),
  proveedor_id bigint references proveedores(id),
  moneda moneda not null default 'USD',
  total numeric(14,2) not null default 0,
  estado estado_comprobante not null default 'confirmado',
  vendedor_id uuid references perfiles(id) default auth.uid(),
  origen_id bigint references comprobantes(id),   -- ej: venta generada desde presupuesto
  deposito_id bigint not null default 1 references depositos(id),
  observaciones text,
  creado timestamptz not null default now(),
  unique (tipo, numero),
  check (
    (tipo in ('presupuesto','pedido','venta','nc_venta') and cliente_id is not null and proveedor_id is null) or
    (tipo in ('compra','nc_compra') and proveedor_id is not null and cliente_id is null)
  )
);
create index comprobantes_cliente_idx on comprobantes (cliente_id, fecha);
create index comprobantes_proveedor_idx on comprobantes (proveedor_id, fecha);

create table comprobante_items (
  id bigint generated always as identity primary key,
  comprobante_id bigint not null references comprobantes(id) on delete cascade,
  producto_id bigint references productos(id),
  descripcion text not null,
  cantidad numeric(12,2) not null check (cantidad > 0),
  precio_unit numeric(12,2) not null,
  costo_unit numeric(12,2),            -- costo al momento de la venta (para margen)
  subtotal numeric(14,2) generated always as (round(cantidad * precio_unit, 2)) stored
);

-- ---------- Stock ----------
create table movimientos_stock (
  id bigint generated always as identity primary key,
  fecha timestamptz not null default now(),
  producto_id bigint not null references productos(id),
  deposito_id bigint not null default 1 references depositos(id),
  cantidad numeric(12,2) not null,      -- positivo entra, negativo sale
  tipo tipo_mov_stock not null,
  comprobante_id bigint references comprobantes(id) on delete cascade,
  costo_unit numeric(12,2),
  usuario_id uuid references perfiles(id) default auth.uid(),
  nota text
);
create index mov_stock_producto_idx on movimientos_stock (producto_id, fecha);

create view stock_actual with (security_invoker = on) as
select p.id as producto_id, p.nombre, p.codigo, p.stock_minimo,
       coalesce(sum(m.cantidad), 0) as stock
from productos p
left join movimientos_stock m on m.producto_id = p.id
group by p.id;

-- Unidades comprometidas en pedidos abiertos
create view stock_reservado with (security_invoker = on) as
select i.producto_id, sum(i.cantidad) as reservado
from comprobante_items i
join comprobantes c on c.id = i.comprobante_id
where c.tipo = 'pedido' and c.estado = 'abierto' and i.producto_id is not null
group by i.producto_id;

-- ---------- Pagos y cobranzas ----------
create table pagos (
  id bigint generated always as identity primary key,
  fecha date not null default current_date,
  cliente_id bigint references clientes(id),
  proveedor_id bigint references proveedores(id),
  moneda moneda not null,
  importe numeric(14,2) not null check (importe > 0),
  medio text not null default 'efectivo',   -- efectivo, transferencia, cheque, cripto...
  notas text,
  usuario_id uuid references perfiles(id) default auth.uid(),
  anulado boolean not null default false,
  creado timestamptz not null default now(),
  check ((cliente_id is null) <> (proveedor_id is null))
);

-- ---------- Cuenta corriente (USD y ARS siempre separados) ----------
-- Positivo = el cliente nos debe. Negativo = saldo a favor del cliente.
create view ctacte_clientes with (security_invoker = on) as
select cliente_id, moneda, fecha, 'comprobante'::text as origen, id as origen_id, tipo::text as concepto, numero,
       case when tipo = 'venta' then total else -total end as importe
from comprobantes
where tipo in ('venta','nc_venta') and estado = 'confirmado'
union all
select cliente_id, moneda, fecha, 'pago', id, 'pago ' || medio, null, -importe
from pagos
where cliente_id is not null and not anulado;

create view saldos_clientes with (security_invoker = on) as
select c.id as cliente_id, c.nombre, c.habilitado,
       coalesce(sum(m.importe) filter (where m.moneda = 'USD'), 0) as saldo_usd,
       coalesce(sum(m.importe) filter (where m.moneda = 'ARS'), 0) as saldo_ars,
       max(m.fecha) as ultimo_mov
from clientes c
left join ctacte_clientes m on m.cliente_id = c.id
group by c.id;

-- Positivo = le debemos al proveedor.
create view ctacte_proveedores with (security_invoker = on) as
select proveedor_id, moneda, fecha, 'comprobante'::text as origen, id as origen_id, tipo::text as concepto, numero,
       case when tipo = 'compra' then total else -total end as importe
from comprobantes
where tipo in ('compra','nc_compra') and estado = 'confirmado'
union all
select proveedor_id, moneda, fecha, 'pago', id, 'pago ' || medio, null, -importe
from pagos
where proveedor_id is not null and not anulado;

create view saldos_proveedores with (security_invoker = on) as
select p.id as proveedor_id, p.nombre,
       coalesce(sum(m.importe) filter (where m.moneda = 'USD'), 0) as saldo_usd,
       coalesce(sum(m.importe) filter (where m.moneda = 'ARS'), 0) as saldo_ars,
       max(m.fecha) as ultimo_mov
from proveedores p
left join ctacte_proveedores m on m.proveedor_id = p.id
group by p.id;

-- ---------- Registrar un comprobante completo (todo o nada) ----------
-- items: [{"producto_id": 1, "descripcion": "...", "cantidad": 2, "precio_unit": 170}]
create function registrar_comprobante(
  p_tipo tipo_comprobante,
  p_cliente_id bigint,
  p_proveedor_id bigint,
  p_moneda moneda,
  p_items jsonb,
  p_observaciones text default null,
  p_origen_id bigint default null
) returns bigint
language plpgsql security invoker set search_path = public as $$
declare
  v_id bigint;
  v_numero int;
  v_total numeric(14,2);
  v_estado estado_comprobante;
  v_signo int;
  v_mov tipo_mov_stock;
  it jsonb;
begin
  if not es_equipo() then
    raise exception 'Sin permiso';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'El comprobante no tiene ítems';
  end if;

  perform pg_advisory_xact_lock(hashtext('comprobante_' || p_tipo::text));
  select coalesce(max(numero), 0) + 1 into v_numero from comprobantes where tipo = p_tipo;

  select coalesce(sum(round((x->>'cantidad')::numeric * (x->>'precio_unit')::numeric, 2)), 0)
    into v_total from jsonb_array_elements(p_items) x;

  v_estado := case when p_tipo = 'pedido' then 'abierto'::estado_comprobante
                   else 'confirmado'::estado_comprobante end;

  insert into comprobantes (tipo, numero, cliente_id, proveedor_id, moneda, total, estado, observaciones, origen_id)
  values (p_tipo, v_numero, p_cliente_id, p_proveedor_id, p_moneda, v_total, v_estado, p_observaciones, p_origen_id)
  returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    insert into comprobante_items (comprobante_id, producto_id, descripcion, cantidad, precio_unit, costo_unit)
    values (
      v_id,
      nullif(it->>'producto_id', '')::bigint,
      it->>'descripcion',
      (it->>'cantidad')::numeric,
      (it->>'precio_unit')::numeric,
      (select costo_usd from productos where id = nullif(it->>'producto_id', '')::bigint)
    );
  end loop;

  -- Movimientos de stock
  v_signo := case p_tipo when 'venta' then -1 when 'nc_compra' then -1
                         when 'compra' then 1 when 'nc_venta' then 1 else 0 end;
  if v_signo <> 0 then
    v_mov := p_tipo::text::tipo_mov_stock;
    insert into movimientos_stock (producto_id, cantidad, tipo, comprobante_id, costo_unit)
    select (x->>'producto_id')::bigint, v_signo * (x->>'cantidad')::numeric, v_mov, v_id,
           case when p_tipo = 'compra' then (x->>'precio_unit')::numeric end
    from jsonb_array_elements(p_items) x
    where nullif(x->>'producto_id', '') is not null;
  end if;

  -- Una compra en USD actualiza el costo del producto
  if p_tipo = 'compra' and p_moneda = 'USD' then
    update productos p set costo_usd = (x->>'precio_unit')::numeric, actualizado = now()
    from jsonb_array_elements(p_items) x
    where p.id = (x->>'producto_id')::bigint;
    insert into historial_costos (producto_id, costo_usd, origen)
    select (x->>'producto_id')::bigint, (x->>'precio_unit')::numeric, 'compra #' || v_numero
    from jsonb_array_elements(p_items) x
    where nullif(x->>'producto_id', '') is not null;
  end if;

  -- Un pedido que se convierte en venta queda cerrado
  if p_origen_id is not null and p_tipo = 'venta' then
    update comprobantes set estado = 'confirmado' where id = p_origen_id and tipo = 'pedido';
  end if;

  return v_id;
end $$;

-- Anular: revierte stock y cuenta corriente
create function anular_comprobante(p_id bigint) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not es_admin() then
    raise exception 'Solo un administrador puede anular';
  end if;
  update comprobantes set estado = 'anulado' where id = p_id;
  delete from movimientos_stock where comprobante_id = p_id;
end $$;

-- ---------- Seguridad (RLS): solo usuarios del equipo ----------
do $$
declare t text;
begin
  foreach t in array array[
    'cotizaciones','depositos','listas_precios','marcas','categorias','productos','precios',
    'historial_costos','clientes','proveedores','comprobantes','comprobante_items',
    'movimientos_stock','pagos'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy equipo_lee on %I for select using (es_equipo())', t);
    execute format('create policy equipo_crea on %I for insert with check (es_equipo())', t);
    execute format('create policy equipo_edita on %I for update using (es_equipo())', t);
    execute format('create policy admin_borra on %I for delete using (es_admin())', t);
  end loop;
end $$;

alter table perfiles enable row level security;
create policy ve_perfiles on perfiles for select using (es_equipo());
create policy admin_edita_perfiles on perfiles for update using (es_admin());

-- =====================================================================
-- DESPUÉS de crear tu usuario (Authentication → Users → Add user),
-- correr esta línea con tu email para hacerte administrador:
--   update perfiles set rol = 'admin' where id = (select id from auth.users where email = 'TU_EMAIL');
-- =====================================================================
