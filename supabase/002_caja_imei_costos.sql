-- =====================================================================
-- WORK SHOP · Migración 002
--   · Cajas: Pesos, Dólares, USDT (y las que quieras sumar: bancos, etc.)
--   · Cobros y pagos con recibo numerado, que impactan en caja.
--     Un cobro en USDT cancela deuda en USD.
--   · IMEI / número de serie en cada unidad que entra y sale.
--   · Costo real por promedio ponderado.
--   · Datos de la empresa para los PDF.
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar todo → Run.
-- Se corre UNA sola vez, después de schema.sql.
-- =====================================================================

-- ---------- Datos de la empresa (encabezado de los PDF) ----------
create table empresa (
  id int primary key default 1 check (id = 1),
  nombre text not null default 'WORK SHOP',
  razon_social text,
  cuit text,
  direccion text,
  localidad text default 'Buenos Aires',
  telefono text default '11 2775-4923',
  email text default 'ventas@clubshop.com.ar',
  pie text default 'Documento no válido como factura.'
);
insert into empresa default values;

-- ---------- Cajas ----------
create type moneda_caja as enum ('ARS', 'USD', 'USDT');

create table cajas (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  moneda moneda_caja not null,
  activa boolean not null default true,
  orden int not null default 0
);
insert into cajas (nombre, moneda, orden) values
  ('Pesos', 'ARS', 1), ('Dólares', 'USD', 2), ('USDT', 'USDT', 3);

-- ---------- Pagos: ahora con caja, número de recibo y tipo de cambio ----------
alter table pagos
  add column numero int,
  add column caja_id bigint references cajas(id),
  add column importe_caja numeric(14,2),
  add column tipo_cambio numeric(14,4);

update pagos p set
  caja_id = (select id from cajas c where c.moneda::text = p.moneda::text),
  importe_caja = p.importe,
  tipo_cambio = 1,
  numero = sub.n
from (
  select id, row_number() over (partition by (cliente_id is not null) order by id) as n from pagos
) sub
where sub.id = p.id;

alter table pagos alter column caja_id set not null;
alter table pagos alter column importe_caja set not null;
alter table pagos alter column numero set not null;
create unique index pagos_recibo_unico on pagos ((cliente_id is not null), numero);

create table movimientos_caja (
  id bigint generated always as identity primary key,
  fecha date not null default current_date,
  caja_id bigint not null references cajas(id),
  importe numeric(14,2) not null,          -- positivo entra, negativo sale
  tipo text not null check (tipo in ('cobro','pago','gasto','retiro','aporte','transferencia','ajuste')),
  concepto text,
  pago_id bigint references pagos(id) on delete cascade,
  grupo uuid,                               -- une las dos patas de una transferencia/cambio
  anulado boolean not null default false,
  usuario_id uuid references perfiles(id) default auth.uid(),
  creado timestamptz not null default now()
);
create index mov_caja_idx on movimientos_caja (caja_id, fecha);

-- Pagos ya existentes → su movimiento de caja
insert into movimientos_caja (fecha, caja_id, importe, tipo, concepto, pago_id, anulado)
select fecha, caja_id,
       case when cliente_id is not null then importe_caja else -importe_caja end,
       case when cliente_id is not null then 'cobro' else 'pago' end,
       'Pago existente', id, anulado
from pagos;

create view saldos_cajas with (security_invoker = on) as
select c.id as caja_id, c.nombre, c.moneda, c.activa, c.orden,
       coalesce(sum(m.importe) filter (where not m.anulado), 0) as saldo
from cajas c
left join movimientos_caja m on m.caja_id = c.id
group by c.id;

-- Cuenta corriente: el pago muestra su número de recibo
create or replace view ctacte_clientes with (security_invoker = on) as
select cliente_id, moneda, fecha, 'comprobante'::text as origen, id as origen_id, tipo::text as concepto, numero,
       case when tipo = 'venta' then total else -total end as importe
from comprobantes
where tipo in ('venta','nc_venta') and estado = 'confirmado'
union all
select p.cliente_id, p.moneda, p.fecha, 'pago', p.id,
       'Recibo · ' || c.nombre || case when c.moneda::text <> p.moneda::text then ' ' || to_char(p.importe_caja, 'FM999G999G990D00') else '' end,
       p.numero, -p.importe
from pagos p join cajas c on c.id = p.caja_id
where p.cliente_id is not null and not p.anulado;

create or replace view ctacte_proveedores with (security_invoker = on) as
select proveedor_id, moneda, fecha, 'comprobante'::text as origen, id as origen_id, tipo::text as concepto, numero,
       case when tipo = 'compra' then total else -total end as importe
from comprobantes
where tipo in ('compra','nc_compra') and estado = 'confirmado'
union all
select p.proveedor_id, p.moneda, p.fecha, 'pago', p.id,
       'Orden de pago · ' || c.nombre || case when c.moneda::text <> p.moneda::text then ' ' || to_char(p.importe_caja, 'FM999G999G990D00') else '' end,
       p.numero, -p.importe
from pagos p join cajas c on c.id = p.caja_id
where p.proveedor_id is not null and not p.anulado;

-- Registrar cobro (cliente) o pago (proveedor): genera recibo y movimiento de caja.
-- p_importe_caja: lo que entra/sale de la caja, en la moneda de la caja.
-- p_moneda / p_importe: cuánto se descuenta de la cuenta corriente y en qué moneda.
create function registrar_pago(
  p_cliente_id bigint,
  p_proveedor_id bigint,
  p_caja_id bigint,
  p_importe_caja numeric,
  p_moneda moneda,
  p_importe numeric,
  p_fecha date default current_date,
  p_notas text default null
) returns bigint
language plpgsql security invoker set search_path = public as $$
declare
  v_caja cajas%rowtype;
  v_numero int;
  v_id bigint;
  v_es_cobro boolean := p_cliente_id is not null;
  v_nombre text;
begin
  if not es_equipo() then raise exception 'Sin permiso'; end if;
  if (p_cliente_id is null) = (p_proveedor_id is null) then raise exception 'Indicá cliente o proveedor'; end if;
  if coalesce(p_importe_caja, 0) <= 0 or coalesce(p_importe, 0) <= 0 then raise exception 'El importe tiene que ser mayor a cero'; end if;
  select * into v_caja from cajas where id = p_caja_id;
  if not found then raise exception 'Caja inexistente'; end if;
  -- Misma moneda (o USDT contra USD 1 a 1 si no se indica otra cosa): los importes deben coincidir
  if v_caja.moneda::text = p_moneda::text and p_importe_caja <> p_importe then
    raise exception 'En la misma moneda, el importe de caja y el de cuenta corriente tienen que ser iguales';
  end if;

  perform pg_advisory_xact_lock(hashtext('recibo_' || v_es_cobro::text));
  select coalesce(max(numero), 0) + 1 into v_numero from pagos where (cliente_id is not null) = v_es_cobro;

  insert into pagos (fecha, cliente_id, proveedor_id, moneda, importe, medio, notas, numero, caja_id, importe_caja, tipo_cambio)
  values (coalesce(p_fecha, current_date), p_cliente_id, p_proveedor_id, p_moneda, p_importe, v_caja.nombre, p_notas,
          v_numero, p_caja_id, p_importe_caja, round(p_importe_caja / p_importe, 4))
  returning id into v_id;

  if v_es_cobro then select nombre into v_nombre from clientes where id = p_cliente_id;
  else select nombre into v_nombre from proveedores where id = p_proveedor_id; end if;

  insert into movimientos_caja (fecha, caja_id, importe, tipo, concepto, pago_id)
  values (coalesce(p_fecha, current_date), p_caja_id,
          case when v_es_cobro then p_importe_caja else -p_importe_caja end,
          case when v_es_cobro then 'cobro' else 'pago' end,
          case when v_es_cobro then 'Recibo ' else 'Orden de pago ' end || lpad(v_numero::text, 5, '0') || ' · ' || v_nombre,
          v_id);
  return v_id;
end $$;

create function anular_pago(p_id bigint) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo un administrador puede anular'; end if;
  update pagos set anulado = true where id = p_id;
  update movimientos_caja set anulado = true where pago_id = p_id;
end $$;

-- Movimiento manual de caja: gasto, retiro, aporte o ajuste
create function movimiento_caja(p_caja_id bigint, p_tipo text, p_importe numeric, p_concepto text, p_fecha date default current_date)
returns bigint
language plpgsql security invoker set search_path = public as $$
declare v_id bigint;
begin
  if not es_equipo() then raise exception 'Sin permiso'; end if;
  if p_tipo not in ('gasto','retiro','aporte','ajuste') then raise exception 'Tipo inválido'; end if;
  if coalesce(p_importe, 0) = 0 then raise exception 'Importe vacío'; end if;
  insert into movimientos_caja (fecha, caja_id, importe, tipo, concepto)
  values (coalesce(p_fecha, current_date), p_caja_id,
          case when p_tipo in ('gasto','retiro') then -abs(p_importe) when p_tipo = 'aporte' then abs(p_importe) else p_importe end,
          p_tipo, p_concepto)
  returning id into v_id;
  return v_id;
end $$;

-- Transferencia o cambio entre cajas (ej: vendo US$ 1.000 y entran $ 1.565.000)
create function transferir_caja(p_origen bigint, p_importe_origen numeric, p_destino bigint, p_importe_destino numeric,
                                p_concepto text, p_fecha date default current_date)
returns void
language plpgsql security invoker set search_path = public as $$
declare g uuid := gen_random_uuid();
begin
  if not es_equipo() then raise exception 'Sin permiso'; end if;
  if p_origen = p_destino then raise exception 'Elegí dos cajas distintas'; end if;
  if coalesce(p_importe_origen, 0) <= 0 or coalesce(p_importe_destino, 0) <= 0 then raise exception 'Importes inválidos'; end if;
  insert into movimientos_caja (fecha, caja_id, importe, tipo, concepto, grupo) values
    (coalesce(p_fecha, current_date), p_origen, -p_importe_origen, 'transferencia', p_concepto, g),
    (coalesce(p_fecha, current_date), p_destino, p_importe_destino, 'transferencia', p_concepto, g);
end $$;

create function anular_movimiento_caja(p_id bigint) returns void
language plpgsql security invoker set search_path = public as $$
declare v_grupo uuid; v_pago bigint;
begin
  if not es_admin() then raise exception 'Solo un administrador puede anular'; end if;
  select grupo, pago_id into v_grupo, v_pago from movimientos_caja where id = p_id;
  if v_pago is not null then raise exception 'Este movimiento es de un recibo: anulá el recibo'; end if;
  update movimientos_caja set anulado = true where id = p_id or (v_grupo is not null and grupo = v_grupo);
end $$;

-- ---------- IMEI / número de serie ----------
alter table productos add column lleva_serie boolean not null default true;

create type estado_unidad as enum ('en_stock', 'vendida', 'devuelta', 'baja');

create table unidades (
  id bigint generated always as identity primary key,
  producto_id bigint not null references productos(id),
  serie text not null unique,
  estado estado_unidad not null default 'en_stock',
  costo_usd numeric(12,2),
  ingreso timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index unidades_producto_idx on unidades (producto_id, estado);

create table item_series (
  item_id bigint not null references comprobante_items(id) on delete cascade,
  unidad_id bigint not null references unidades(id),
  primary key (item_id, unidad_id)
);

create table ajuste_series (
  movimiento_id bigint not null references movimientos_stock(id) on delete cascade,
  unidad_id bigint not null references unidades(id),
  primary key (movimiento_id, unidad_id)
);

-- Historial de una serie: dónde entró y dónde salió
create view historial_series with (security_invoker = on) as
select u.serie, u.id as unidad_id, u.producto_id, c.id as comprobante_id, c.tipo::text as tipo, c.numero, c.fecha, c.estado::text as estado,
       coalesce(cl.nombre, pr.nombre) as tercero
from unidades u
join item_series s on s.unidad_id = u.id
join comprobante_items i on i.id = s.item_id
join comprobantes c on c.id = i.comprobante_id
left join clientes cl on cl.id = c.cliente_id
left join proveedores pr on pr.id = c.proveedor_id;

-- Normaliza una lista de series de un ítem (sin espacios, sin vacíos, sin repetidos)
create function series_de(it jsonb) returns text[]
language sql immutable as $$
  select coalesce(array_agg(distinct s), '{}')
  from (select upper(trim(x)) as s from jsonb_array_elements_text(coalesce(it->'series', '[]'::jsonb)) x) t
  where s <> '';
$$;

-- ---------- registrar_comprobante con IMEI y costo promedio ----------
-- items: [{"producto_id":1,"descripcion":"...","cantidad":2,"precio_unit":170,"series":["3567...","3567..."]}]
create or replace function registrar_comprobante(
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
  v_cotiz numeric;
  v_item_id bigint;
  v_prod productos%rowtype;
  v_stock numeric;
  v_cant numeric;
  v_precio numeric;
  v_precio_usd numeric;
  v_series text[];
  v_serie text;
  v_unidad unidades%rowtype;
  v_mueve boolean;
  it jsonb;
begin
  if not es_equipo() then raise exception 'Sin permiso'; end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'El comprobante no tiene ítems'; end if;

  v_mueve := p_tipo in ('venta','nc_venta','compra','nc_compra');
  v_signo := case p_tipo when 'venta' then -1 when 'nc_compra' then -1 when 'compra' then 1 when 'nc_venta' then 1 else 0 end;

  if p_tipo = 'compra' and p_moneda = 'ARS' then
    select usd_ars into v_cotiz from cotizaciones order by fecha desc limit 1;
    if v_cotiz is null then raise exception 'Cargá el dólar del día antes de una compra en pesos'; end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('comprobante_' || p_tipo::text));
  select coalesce(max(numero), 0) + 1 into v_numero from comprobantes where tipo = p_tipo;

  select coalesce(sum(round((x->>'cantidad')::numeric * (x->>'precio_unit')::numeric, 2)), 0)
    into v_total from jsonb_array_elements(p_items) x;

  v_estado := case when p_tipo = 'pedido' then 'abierto'::estado_comprobante else 'confirmado'::estado_comprobante end;

  insert into comprobantes (tipo, numero, cliente_id, proveedor_id, moneda, total, estado, observaciones, origen_id)
  values (p_tipo, v_numero, p_cliente_id, p_proveedor_id, p_moneda, v_total, v_estado, p_observaciones, p_origen_id)
  returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    v_cant := (it->>'cantidad')::numeric;
    v_precio := (it->>'precio_unit')::numeric;
    v_prod := null;
    if nullif(it->>'producto_id', '') is not null then
      select * into v_prod from productos where id = (it->>'producto_id')::bigint for update;
      if not found then raise exception 'Producto % inexistente', it->>'producto_id'; end if;
    end if;

    insert into comprobante_items (comprobante_id, producto_id, descripcion, cantidad, precio_unit, costo_unit)
    values (v_id, v_prod.id, it->>'descripcion', v_cant, v_precio,
            case when p_tipo = 'compra' then round(case when p_moneda = 'ARS' then v_precio / v_cotiz else v_precio end, 2)
                 else v_prod.costo_usd end)
    returning id into v_item_id;

    continue when v_prod.id is null or not v_mueve;

    -- Series (IMEI)
    if v_prod.lleva_serie then
      v_series := series_de(it);
      if v_cant <> trunc(v_cant) then raise exception '%: con número de serie la cantidad tiene que ser entera', v_prod.nombre; end if;
      if coalesce(array_length(v_series, 1), 0) <> v_cant then
        raise exception '%: cargaste % series para % unidades', v_prod.nombre, coalesce(array_length(v_series, 1), 0), v_cant;
      end if;

      foreach v_serie in array v_series loop
        select * into v_unidad from unidades where serie = v_serie for update;

        if p_tipo = 'compra' then
          if found and v_unidad.estado = 'en_stock' then raise exception 'La serie % ya está en stock', v_serie; end if;
          if found then
            update unidades set producto_id = v_prod.id, estado = 'en_stock', actualizado = now(),
                   costo_usd = case when p_moneda = 'ARS' then round(v_precio / v_cotiz, 2) else v_precio end
            where id = v_unidad.id returning * into v_unidad;
          else
            insert into unidades (producto_id, serie, costo_usd)
            values (v_prod.id, v_serie, case when p_moneda = 'ARS' then round(v_precio / v_cotiz, 2) else v_precio end)
            returning * into v_unidad;
          end if;

        elsif p_tipo = 'venta' or p_tipo = 'nc_compra' then
          if not found or v_unidad.producto_id <> v_prod.id then raise exception 'La serie % no corresponde a %', v_serie, v_prod.nombre; end if;
          if v_unidad.estado <> 'en_stock' then raise exception 'La serie % no está en stock', v_serie; end if;
          update unidades set estado = case when p_tipo = 'venta' then 'vendida'::estado_unidad else 'devuelta'::estado_unidad end,
                 actualizado = now() where id = v_unidad.id;

        elsif p_tipo = 'nc_venta' then
          if not found or v_unidad.producto_id <> v_prod.id then raise exception 'La serie % no corresponde a %', v_serie, v_prod.nombre; end if;
          if v_unidad.estado <> 'vendida' then raise exception 'La serie % no figura vendida', v_serie; end if;
          update unidades set estado = 'en_stock', actualizado = now() where id = v_unidad.id;
        end if;

        insert into item_series (item_id, unidad_id) values (v_item_id, v_unidad.id);
      end loop;
    end if;

    -- Costo promedio ponderado al comprar
    if p_tipo = 'compra' then
      v_precio_usd := case when p_moneda = 'ARS' then v_precio / v_cotiz else v_precio end;
      select coalesce(sum(cantidad), 0) into v_stock from movimientos_stock where producto_id = v_prod.id;
      update productos set
        costo_usd = round(case when greatest(v_stock, 0) + v_cant = 0 then v_precio_usd
                               else (greatest(v_stock, 0) * costo_usd + v_cant * v_precio_usd) / (greatest(v_stock, 0) + v_cant) end, 2),
        actualizado = now()
      where id = v_prod.id;
      insert into historial_costos (producto_id, costo_usd, origen)
      select v_prod.id, costo_usd, 'compra #' || v_numero || ' a ' || round(v_precio_usd, 2) from productos where id = v_prod.id;
    end if;

    insert into movimientos_stock (producto_id, cantidad, tipo, comprobante_id, costo_unit)
    values (v_prod.id, v_signo * v_cant, p_tipo::text::tipo_mov_stock, v_id,
            case when p_tipo = 'compra' then round(case when p_moneda = 'ARS' then v_precio / v_cotiz else v_precio end, 2) else v_prod.costo_usd end);
  end loop;

  if p_origen_id is not null and p_tipo = 'venta' then
    update comprobantes set estado = 'confirmado' where id = p_origen_id and tipo = 'pedido';
  end if;

  return v_id;
end $$;

-- Anular: revierte stock, series, costo promedio y cuenta corriente
create or replace function anular_comprobante(p_id bigint) returns void
language plpgsql security invoker set search_path = public as $$
declare
  c comprobantes%rowtype;
  m record;
  v_stock numeric;
begin
  if not es_admin() then raise exception 'Solo un administrador puede anular'; end if;
  select * into c from comprobantes where id = p_id for update;
  if not found or c.estado = 'anulado' then return; end if;

  -- Series
  if c.tipo = 'compra' then
    if exists (select 1 from item_series s join comprobante_items i on i.id = s.item_id join unidades u on u.id = s.unidad_id
               where i.comprobante_id = p_id and u.estado <> 'en_stock') then
      raise exception 'No se puede anular: hay unidades de esta compra que ya salieron';
    end if;
    update unidades set estado = 'baja', actualizado = now()
    where id in (select s.unidad_id from item_series s join comprobante_items i on i.id = s.item_id where i.comprobante_id = p_id);
  elsif c.tipo in ('venta', 'nc_compra') then
    update unidades set estado = 'en_stock', actualizado = now()
    where id in (select s.unidad_id from item_series s join comprobante_items i on i.id = s.item_id where i.comprobante_id = p_id);
  elsif c.tipo = 'nc_venta' then
    if exists (select 1 from item_series s join comprobante_items i on i.id = s.item_id join unidades u on u.id = s.unidad_id
               where i.comprobante_id = p_id and u.estado <> 'en_stock') then
      raise exception 'No se puede anular: hay unidades devueltas que ya se volvieron a vender';
    end if;
    update unidades set estado = 'vendida', actualizado = now()
    where id in (select s.unidad_id from item_series s join comprobante_items i on i.id = s.item_id where i.comprobante_id = p_id);
  end if;

  -- Costo promedio: se saca la compra del promedio
  if c.tipo = 'compra' then
    for m in select producto_id, cantidad, costo_unit from movimientos_stock where comprobante_id = p_id loop
      select coalesce(sum(cantidad), 0) into v_stock from movimientos_stock where producto_id = m.producto_id;
      if v_stock - m.cantidad > 0 then
        update productos set costo_usd = round((v_stock * costo_usd - m.cantidad * m.costo_unit) / (v_stock - m.cantidad), 2)
        where id = m.producto_id;
      end if;
    end loop;
  end if;

  update comprobantes set estado = 'anulado' where id = p_id;
  delete from movimientos_stock where comprobante_id = p_id;
end $$;

-- Ajuste de stock con series: entrada (crea unidades) o salida (las da de baja)
create function ajustar_stock(p_producto_id bigint, p_cantidad numeric, p_series jsonb, p_nota text)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_prod productos%rowtype;
  v_series text[];
  v_serie text;
  v_mov bigint;
  v_unidad unidades%rowtype;
begin
  if not es_equipo() then raise exception 'Sin permiso'; end if;
  if coalesce(p_cantidad, 0) = 0 then raise exception 'Cantidad vacía'; end if;
  select * into v_prod from productos where id = p_producto_id;

  insert into movimientos_stock (producto_id, cantidad, tipo, nota, costo_unit)
  values (p_producto_id, p_cantidad, 'ajuste', p_nota, v_prod.costo_usd) returning id into v_mov;

  if v_prod.lleva_serie then
    v_series := series_de(jsonb_build_object('series', coalesce(p_series, '[]'::jsonb)));
    if coalesce(array_length(v_series, 1), 0) <> abs(p_cantidad) then
      raise exception 'Cargaste % series para % unidades', coalesce(array_length(v_series, 1), 0), abs(p_cantidad);
    end if;
    foreach v_serie in array v_series loop
      select * into v_unidad from unidades where serie = v_serie for update;
      if p_cantidad > 0 then
        if found and v_unidad.estado = 'en_stock' then raise exception 'La serie % ya está en stock', v_serie; end if;
        if found then
          update unidades set producto_id = p_producto_id, estado = 'en_stock', costo_usd = v_prod.costo_usd, actualizado = now()
          where id = v_unidad.id returning * into v_unidad;
        else
          insert into unidades (producto_id, serie, costo_usd) values (p_producto_id, v_serie, v_prod.costo_usd) returning * into v_unidad;
        end if;
      else
        if not found or v_unidad.producto_id <> p_producto_id or v_unidad.estado <> 'en_stock' then
          raise exception 'La serie % no está en stock de este producto', v_serie;
        end if;
        update unidades set estado = 'baja', actualizado = now() where id = v_unidad.id;
      end if;
      insert into ajuste_series (movimiento_id, unidad_id) values (v_mov, v_unidad.id);
    end loop;
  end if;
end $$;

-- Series automáticas para artículos sin IMEI de fábrica (fundas, cargadores…)
create sequence serie_interna_seq;
create function nuevas_series(p_cantidad int) returns text[]
language sql volatile as $$
  select array_agg('WS' || lpad(nextval('serie_interna_seq')::text, 7, '0')) from generate_series(1, greatest(p_cantidad, 0));
$$;

-- ---------- Seguridad ----------
do $$
declare t text;
begin
  foreach t in array array['empresa','cajas','movimientos_caja','unidades','item_series','ajuste_series'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy equipo_lee on %I for select using (es_equipo())', t);
    execute format('create policy equipo_crea on %I for insert with check (es_equipo())', t);
    execute format('create policy equipo_edita on %I for update using (es_equipo())', t);
    execute format('create policy admin_borra on %I for delete using (es_admin())', t);
  end loop;
end $$;
grant usage on sequence serie_interna_seq to authenticated;
