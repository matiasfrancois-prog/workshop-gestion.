-- =====================================================================
-- WORK SHOP · Migración 004
--   · Modificar comprobantes y recibos (queda registrado quién y cuándo).
--   · Orden de compra: mercadería pendiente de recibir. Al recibirla se
--     convierte en compra (mueve stock, deuda y recalcula el costo promedio).
--   · Datos de compra como en Cianbox: comprobante del proveedor, vencimiento,
--     cotización, actualiza costos sí/no, contado o cuenta corriente.
--   · Categorías de gasto.
--   · Estado de cada factura: Pagado o saldo pendiente.
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar todo → Run.
-- Se corre UNA sola vez, después de 003.
-- =====================================================================

alter type tipo_comprobante add value if not exists 'orden_compra';

alter table comprobantes
  add column if not exists nro_externo text,              -- ej: FAC A 0001-00004535 del proveedor
  add column if not exists vencimiento date,
  add column if not exists cotizacion numeric(14,2),       -- dólar de referencia del comprobante
  add column if not exists actualiza_costos boolean not null default true,
  add column if not exists contado boolean not null default false,
  add column if not exists modificado timestamptz,
  add column if not exists modificado_por uuid references perfiles(id);

alter table comprobantes drop constraint if exists comprobantes_tercero_check;
alter table comprobantes add constraint comprobantes_tercero_check check (
  (tipo::text in ('presupuesto','pedido','venta','nc_venta','nd_venta') and cliente_id is not null and proveedor_id is null) or
  (tipo::text in ('compra','nc_compra','nd_compra','orden_compra') and proveedor_id is not null and cliente_id is null)
);

alter table pagos
  add column if not exists modificado timestamptz,
  add column if not exists modificado_por uuid references perfiles(id);

-- Unidades pedidas en órdenes de compra abiertas (mercadería en camino)
create or replace view stock_en_camino with (security_invoker = on) as
select i.producto_id, sum(i.cantidad) as en_camino
from comprobante_items i join comprobantes c on c.id = i.comprobante_id
where c.tipo::text = 'orden_compra' and c.estado = 'abierto' and i.producto_id is not null
group by i.producto_id;

-- Recalcula el costo promedio ponderado de un producto repasando su historia
-- (se usa al modificar o anular una compra, aunque sea vieja).
create or replace function recalcular_costo(p_producto_id bigint) returns numeric
language plpgsql security invoker set search_path = public as $$
declare
  m record;
  v_stock numeric := 0;
  v_costo numeric := null;
begin
  for m in
    select ms.cantidad, ms.costo_unit, ms.tipo::text as tipo, coalesce(c.actualiza_costos, true) as actualiza
    from movimientos_stock ms left join comprobantes c on c.id = ms.comprobante_id
    where ms.producto_id = p_producto_id
    order by ms.fecha, ms.id
  loop
    if m.tipo = 'compra' and m.actualiza and m.cantidad > 0 then
      v_costo := case when v_costo is null or v_stock <= 0 then m.costo_unit
                      else (v_stock * v_costo + m.cantidad * m.costo_unit) / (v_stock + m.cantidad) end;
    end if;
    v_stock := v_stock + m.cantidad;
  end loop;
  if v_costo is not null then
    update productos set costo_usd = round(v_costo, 2), actualizado = now() where id = p_producto_id and costo_usd <> round(v_costo, 2);
  end if;
  return round(v_costo, 2);
end $$;

-- =====================================================================
-- Motor de comprobantes: aplicar y revertir ítems
-- =====================================================================

-- Deshace el efecto de los ítems (stock, series, costo promedio).
--   p_modificar = true  → se va a volver a cargar (borra ítems, no da de baja series de compra)
--   p_modificar = false → anulación
-- Devuelve las series que tenía el comprobante.
create or replace function _revertir_items(p_id bigint, p_modificar boolean) returns text[]
language plpgsql security invoker set search_path = public as $$
declare
  c comprobantes%rowtype;
  v_prev text[];
begin
  select * into c from comprobantes where id = p_id for update;
  select coalesce(array_agg(u.serie), '{}') into v_prev
  from item_series s join comprobante_items i on i.id = s.item_id join unidades u on u.id = s.unidad_id
  where i.comprobante_id = p_id;

  if c.estado <> 'anulado' then
    if c.tipo::text = 'compra' then
      if not p_modificar then
        if exists (select 1 from item_series s join comprobante_items i on i.id = s.item_id join unidades u on u.id = s.unidad_id
                   where i.comprobante_id = p_id and u.estado <> 'en_stock') then
          raise exception 'No se puede anular: hay unidades de esta compra que ya salieron';
        end if;
        update unidades set estado = 'baja', actualizado = now()
        where id in (select s.unidad_id from item_series s join comprobante_items i on i.id = s.item_id where i.comprobante_id = p_id);
      end if;
    elsif c.tipo::text in ('venta', 'nc_compra') then
      update unidades set estado = 'en_stock', actualizado = now()
      where id in (select s.unidad_id from item_series s join comprobante_items i on i.id = s.item_id where i.comprobante_id = p_id);
    elsif c.tipo::text = 'nc_venta' then
      if exists (select 1 from item_series s join comprobante_items i on i.id = s.item_id join unidades u on u.id = s.unidad_id
                 where i.comprobante_id = p_id and u.estado <> 'en_stock') then
        raise exception 'Hay unidades devueltas en este comprobante que ya se volvieron a vender';
      end if;
      update unidades set estado = 'vendida', actualizado = now()
      where id in (select s.unidad_id from item_series s join comprobante_items i on i.id = s.item_id where i.comprobante_id = p_id);
    end if;
    delete from movimientos_stock where comprobante_id = p_id;
  end if;

  if p_modificar then
    delete from comprobante_items where comprobante_id = p_id;
  end if;
  return v_prev;
end $$;

-- Carga los ítems de un comprobante y aplica sus efectos. Devuelve el total.
-- p_prev: series que ya tenía (al modificar una compra, se respetan aunque ya se hayan vendido).
create or replace function _aplicar_items(p_id bigint, p_items jsonb, p_prev text[] default '{}') returns numeric
language plpgsql security invoker set search_path = public as $$
declare
  c comprobantes%rowtype;
  v_mueve boolean;
  v_signo int;
  v_cotiz numeric;
  v_total numeric := 0;
  v_item_id bigint;
  v_prod productos%rowtype;
  v_stock numeric;
  v_cant numeric;
  v_precio numeric;
  v_precio_usd numeric;
  v_series text[];
  v_nuevas text[] := '{}';
  v_serie text;
  v_unidad unidades%rowtype;
  it jsonb;
begin
  select * into c from comprobantes where id = p_id;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'El comprobante no tiene ítems'; end if;

  v_mueve := c.tipo::text in ('venta','nc_venta','compra','nc_compra');
  v_signo := case c.tipo::text when 'venta' then -1 when 'nc_compra' then -1 when 'compra' then 1 when 'nc_venta' then 1 else 0 end;

  if c.tipo::text = 'compra' and c.moneda = 'ARS' then
    v_cotiz := c.cotizacion;
    if v_cotiz is null then select usd_ars into v_cotiz from cotizaciones order by fecha desc limit 1; end if;
    if v_cotiz is null then raise exception 'Cargá la cotización del dólar para una compra en pesos'; end if;
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    v_cant := (it->>'cantidad')::numeric;
    v_precio := (it->>'precio_unit')::numeric;
    if coalesce(v_cant, 0) <= 0 then raise exception 'Cantidad inválida en %', it->>'descripcion'; end if;
    v_precio_usd := case when c.tipo::text = 'compra' and c.moneda = 'ARS' then v_precio / v_cotiz else v_precio end;
    v_prod := null;
    if nullif(it->>'producto_id', '') is not null then
      select * into v_prod from productos where id = (it->>'producto_id')::bigint for update;
      if not found then raise exception 'Producto % inexistente', it->>'producto_id'; end if;
    end if;

    insert into comprobante_items (comprobante_id, producto_id, descripcion, cantidad, precio_unit, costo_unit)
    values (p_id, v_prod.id, it->>'descripcion', v_cant, v_precio,
            case when c.tipo::text = 'compra' then round(v_precio_usd, 2) else v_prod.costo_usd end)
    returning id into v_item_id;
    v_total := v_total + round(v_cant * v_precio, 2);

    continue when v_prod.id is null or not v_mueve;

    if v_prod.lleva_serie then
      v_series := series_de(it);
      if v_cant <> trunc(v_cant) then raise exception '%: con número de serie la cantidad tiene que ser entera', v_prod.nombre; end if;
      if coalesce(array_length(v_series, 1), 0) <> v_cant then
        raise exception '%: cargaste % series para % unidades', v_prod.nombre, coalesce(array_length(v_series, 1), 0), v_cant;
      end if;

      foreach v_serie in array v_series loop
        select * into v_unidad from unidades where serie = v_serie for update;

        if c.tipo::text = 'compra' then
          v_nuevas := v_nuevas || v_serie;
          if found and v_serie = any(p_prev) then
            if v_unidad.producto_id <> v_prod.id and v_unidad.estado <> 'en_stock' then
              raise exception 'La serie % ya salió como otro producto', v_serie;
            end if;
            update unidades set producto_id = v_prod.id, costo_usd = round(v_precio_usd, 2), actualizado = now()
            where id = v_unidad.id returning * into v_unidad;
          elsif found and v_unidad.estado = 'en_stock' then
            raise exception 'La serie % ya está en stock', v_serie;
          elsif found then
            update unidades set producto_id = v_prod.id, estado = 'en_stock', costo_usd = round(v_precio_usd, 2), actualizado = now()
            where id = v_unidad.id returning * into v_unidad;
          else
            insert into unidades (producto_id, serie, costo_usd) values (v_prod.id, v_serie, round(v_precio_usd, 2))
            returning * into v_unidad;
          end if;

        elsif c.tipo::text in ('venta', 'nc_compra') then
          if not found or v_unidad.producto_id <> v_prod.id then raise exception 'La serie % no corresponde a %', v_serie, v_prod.nombre; end if;
          if v_unidad.estado <> 'en_stock' then raise exception 'La serie % no está en stock', v_serie; end if;
          update unidades set estado = case when c.tipo::text = 'venta' then 'vendida'::estado_unidad else 'devuelta'::estado_unidad end,
                 actualizado = now() where id = v_unidad.id;

        elsif c.tipo::text = 'nc_venta' then
          if not found or v_unidad.producto_id <> v_prod.id then raise exception 'La serie % no corresponde a %', v_serie, v_prod.nombre; end if;
          if v_unidad.estado <> 'vendida' then raise exception 'La serie % no figura vendida', v_serie; end if;
          update unidades set estado = 'en_stock', actualizado = now() where id = v_unidad.id;
        end if;

        insert into item_series (item_id, unidad_id) values (v_item_id, v_unidad.id);
      end loop;
    end if;

    -- Costo promedio ponderado
    if c.tipo::text = 'compra' and c.actualiza_costos then
      select coalesce(sum(cantidad), 0) into v_stock from movimientos_stock where producto_id = v_prod.id;
      update productos set
        costo_usd = round(case when greatest(v_stock, 0) + v_cant = 0 then v_precio_usd
                               else (greatest(v_stock, 0) * costo_usd + v_cant * v_precio_usd) / (greatest(v_stock, 0) + v_cant) end, 2),
        actualizado = now()
      where id = v_prod.id;
      insert into historial_costos (producto_id, costo_usd, origen)
      select v_prod.id, costo_usd, 'compra #' || c.numero || ' a ' || round(v_precio_usd, 2) from productos where id = v_prod.id;
    end if;

    insert into movimientos_stock (producto_id, cantidad, tipo, comprobante_id, costo_unit, fecha)
    values (v_prod.id, v_signo * v_cant, c.tipo::text::tipo_mov_stock, p_id,
            case when c.tipo::text = 'compra' then round(v_precio_usd, 2) else v_prod.costo_usd end,
            c.fecha + (c.creado at time zone 'America/Argentina/Buenos_Aires')::time);  -- fecha del comprobante + hora de carga (estable al modificar)
  end loop;

  -- Series que se quitaron de una compra modificada
  if c.tipo::text = 'compra' then
    for v_serie in select unnest(p_prev) except select unnest(v_nuevas) loop
      select * into v_unidad from unidades where serie = v_serie for update;
      if v_unidad.estado <> 'en_stock' then
        raise exception 'La serie % ya salió del stock: no se puede quitar de la compra', v_serie;
      end if;
      update unidades set estado = 'baja', actualizado = now() where id = v_unidad.id;
    end loop;
  end if;

  return v_total;
end $$;

-- Datos opcionales de cabecera (p_extra):
--   {"fecha":"2026-10-28","nro_externo":"FAC A 0001-00004535","vencimiento":"2026-11-15",
--    "cotizacion":1565,"actualiza_costos":true,"contado":false}
drop function if exists registrar_comprobante(tipo_comprobante, bigint, bigint, moneda, jsonb, text, bigint);
create function registrar_comprobante(
  p_tipo tipo_comprobante,
  p_cliente_id bigint,
  p_proveedor_id bigint,
  p_moneda moneda,
  p_items jsonb,
  p_observaciones text default null,
  p_origen_id bigint default null,
  p_extra jsonb default '{}'
) returns bigint
language plpgsql security invoker set search_path = public as $$
declare
  v_id bigint;
  v_numero int;
  v_total numeric;
begin
  if not es_equipo() then raise exception 'Sin permiso'; end if;
  perform pg_advisory_xact_lock(hashtext('comprobante_' || p_tipo::text));
  select coalesce(max(numero), 0) + 1 into v_numero from comprobantes where tipo = p_tipo;

  insert into comprobantes (tipo, numero, fecha, cliente_id, proveedor_id, moneda, total, estado, observaciones, origen_id,
                            nro_externo, vencimiento, cotizacion, actualiza_costos, contado)
  values (p_tipo, v_numero, coalesce(nullif(p_extra->>'fecha', '')::date, current_date), p_cliente_id, p_proveedor_id, p_moneda, 0,
          case when p_tipo::text in ('pedido', 'orden_compra') then 'abierto'::estado_comprobante else 'confirmado'::estado_comprobante end,
          p_observaciones, p_origen_id,
          nullif(trim(p_extra->>'nro_externo'), ''), nullif(p_extra->>'vencimiento', '')::date,
          nullif(p_extra->>'cotizacion', '')::numeric, coalesce((p_extra->>'actualiza_costos')::boolean, true),
          coalesce((p_extra->>'contado')::boolean, false))
  returning id into v_id;

  v_total := _aplicar_items(v_id, p_items);
  update comprobantes set total = v_total where id = v_id;

  -- Pedido → venta, u orden de compra → compra: el origen queda cerrado
  if p_origen_id is not null and p_tipo::text in ('venta', 'compra') then
    update comprobantes set estado = 'confirmado'
    where id = p_origen_id and tipo::text in ('pedido', 'orden_compra') and estado = 'abierto';
  end if;
  return v_id;
end $$;

-- Modificar un comprobante: deshace sus efectos y lo vuelve a cargar con los datos nuevos (mismo número)
create or replace function modificar_comprobante(
  p_id bigint,
  p_cliente_id bigint,
  p_proveedor_id bigint,
  p_moneda moneda,
  p_items jsonb,
  p_observaciones text default null,
  p_extra jsonb default '{}'
) returns bigint
language plpgsql security invoker set search_path = public as $$
declare
  c comprobantes%rowtype;
  v_prev text[];
  v_prods bigint[];
  v_total numeric;
begin
  if not es_equipo() then raise exception 'Sin permiso'; end if;
  select * into c from comprobantes where id = p_id for update;
  if not found then raise exception 'Comprobante inexistente'; end if;
  if c.estado = 'anulado' then raise exception 'No se puede modificar un comprobante anulado'; end if;

  select coalesce(array_agg(distinct producto_id) filter (where producto_id is not null), '{}') into v_prods
  from comprobante_items where comprobante_id = p_id;
  v_prev := _revertir_items(p_id, true);

  update comprobantes set
    cliente_id = p_cliente_id,
    proveedor_id = p_proveedor_id,
    moneda = p_moneda,
    observaciones = p_observaciones,
    fecha = coalesce(nullif(p_extra->>'fecha', '')::date, fecha),
    nro_externo = nullif(trim(p_extra->>'nro_externo'), ''),
    vencimiento = nullif(p_extra->>'vencimiento', '')::date,
    cotizacion = nullif(p_extra->>'cotizacion', '')::numeric,
    actualiza_costos = coalesce((p_extra->>'actualiza_costos')::boolean, actualiza_costos),
    contado = coalesce((p_extra->>'contado')::boolean, contado),
    modificado = now(),
    modificado_por = auth.uid()
  where id = p_id;

  v_total := _aplicar_items(p_id, p_items, v_prev);
  update comprobantes set total = v_total where id = p_id;

  if c.tipo::text = 'compra' then
    select v_prods || coalesce(array_agg(distinct producto_id) filter (where producto_id is not null), '{}') into v_prods
    from comprobante_items where comprobante_id = p_id;
    perform recalcular_costo(x) from (select distinct unnest(v_prods) as x) t;
  end if;
  return p_id;
end $$;

create or replace function anular_comprobante(p_id bigint) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo un administrador puede anular'; end if;
  perform _revertir_items(p_id, false);
  update comprobantes set estado = 'anulado', modificado = now(), modificado_por = auth.uid() where id = p_id;
  if (select tipo::text from comprobantes where id = p_id) = 'compra' then
    perform recalcular_costo(x) from (select distinct producto_id as x from comprobante_items where comprobante_id = p_id and producto_id is not null) t;
  end if;
end $$;

-- Las notas de crédito/débito usan el motor nuevo
create or replace function nota_cuenta(
  p_tipo text, p_cliente_id bigint, p_proveedor_id bigint, p_moneda moneda, p_importe numeric, p_concepto text, p_fecha date default current_date
) returns bigint
language plpgsql security invoker set search_path = public as $$
begin
  if p_tipo not in ('nc_venta','nd_venta','nc_compra','nd_compra') then raise exception 'Tipo de nota inválido'; end if;
  if coalesce(p_importe, 0) <= 0 then raise exception 'El importe tiene que ser mayor a cero'; end if;
  return registrar_comprobante(
    p_tipo::tipo_comprobante, p_cliente_id, p_proveedor_id, p_moneda,
    jsonb_build_array(jsonb_build_object('producto_id', null, 'descripcion', coalesce(nullif(trim(p_concepto), ''), 'Ajuste de cuenta'), 'cantidad', 1, 'precio_unit', p_importe)),
    null, null, jsonb_build_object('fecha', coalesce(p_fecha, current_date)));
end $$;

-- =====================================================================
-- Modificar recibo / orden de pago
-- =====================================================================
create or replace function modificar_pago(
  p_id bigint, p_caja_id bigint, p_importe_caja numeric, p_moneda moneda, p_importe numeric, p_fecha date, p_notas text
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  p pagos%rowtype;
  v_caja cajas%rowtype;
begin
  if not es_equipo() then raise exception 'Sin permiso'; end if;
  select * into p from pagos where id = p_id for update;
  if not found then raise exception 'Recibo inexistente'; end if;
  if p.anulado then raise exception 'No se puede modificar un recibo anulado'; end if;
  if coalesce(p_importe_caja, 0) <= 0 or coalesce(p_importe, 0) <= 0 then raise exception 'El importe tiene que ser mayor a cero'; end if;
  select * into v_caja from cajas where id = p_caja_id;
  if v_caja.moneda::text = p_moneda::text and p_importe_caja <> p_importe then
    raise exception 'En la misma moneda, el importe de caja y el de cuenta corriente tienen que ser iguales';
  end if;

  update pagos set caja_id = p_caja_id, importe_caja = p_importe_caja, moneda = p_moneda, importe = p_importe,
         fecha = coalesce(p_fecha, fecha), notas = p_notas, medio = v_caja.nombre,
         tipo_cambio = round(p_importe_caja / p_importe, 4), modificado = now(), modificado_por = auth.uid()
  where id = p_id;

  update movimientos_caja set caja_id = p_caja_id, fecha = coalesce(p_fecha, fecha),
         importe = case when p.cliente_id is not null then p_importe_caja else -p_importe_caja end
  where pago_id = p_id;
end $$;

-- =====================================================================
-- Categorías de gasto
-- =====================================================================
create table if not exists categorias_gasto (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  activa boolean not null default true,
  orden int not null default 0
);
insert into categorias_gasto (nombre, orden) values
  ('Envíos y fletes', 1), ('Alquiler', 2), ('Sueldos', 3), ('Servicios', 4), ('Comisiones', 5),
  ('Impuestos', 6), ('Mantenimiento', 7), ('Publicidad', 8), ('Varios', 9)
on conflict (nombre) do nothing;

alter table categorias_gasto enable row level security;
create policy equipo_lee on categorias_gasto for select using (es_equipo());
create policy admin_crea on categorias_gasto for insert with check (es_admin());
create policy admin_edita on categorias_gasto for update using (es_admin());

alter table movimientos_caja add column if not exists categoria_id bigint references categorias_gasto(id);

drop function if exists movimiento_caja(bigint, text, numeric, text, date);
create function movimiento_caja(p_caja_id bigint, p_tipo text, p_importe numeric, p_concepto text,
                                p_fecha date default current_date, p_categoria_id bigint default null)
returns bigint
language plpgsql security invoker set search_path = public as $$
declare v_id bigint;
begin
  if not es_equipo() then raise exception 'Sin permiso'; end if;
  if p_tipo not in ('gasto','retiro','aporte','ajuste') then raise exception 'Tipo inválido'; end if;
  if coalesce(p_importe, 0) = 0 then raise exception 'Importe vacío'; end if;
  if p_tipo = 'gasto' and p_categoria_id is null then raise exception 'Elegí la categoría del gasto'; end if;
  insert into movimientos_caja (fecha, caja_id, importe, tipo, concepto, categoria_id)
  values (coalesce(p_fecha, current_date), p_caja_id,
          case when p_tipo in ('gasto','retiro') then -abs(p_importe) when p_tipo = 'aporte' then abs(p_importe) else p_importe end,
          p_tipo, p_concepto, case when p_tipo = 'gasto' then p_categoria_id end)
  returning id into v_id;
  return v_id;
end $$;

-- =====================================================================
-- Estado de cada factura / ND: cuánto queda pendiente
-- Los pagos y notas de crédito se aplican a las facturas más viejas primero.
-- =====================================================================
create or replace view estado_documentos with (security_invoker = on) as
with deb as (
  select id, coalesce(cliente_id, proveedor_id) as tercero, (cliente_id is not null) as es_cliente, moneda, total,
         sum(total) over (partition by coalesce(cliente_id, proveedor_id), (cliente_id is not null), moneda
                          order by fecha, id rows unbounded preceding) as acumulado
  from comprobantes
  where estado = 'confirmado' and tipo::text in ('venta','nd_venta','compra','nd_compra')
), cred as (
  select tercero, es_cliente, moneda, sum(importe) as credito from (
    select coalesce(cliente_id, proveedor_id) as tercero, (cliente_id is not null) as es_cliente, moneda, total as importe
    from comprobantes where estado = 'confirmado' and tipo::text in ('nc_venta','nc_compra')
    union all
    select coalesce(cliente_id, proveedor_id), (cliente_id is not null), moneda, importe from pagos where not anulado
  ) x group by 1, 2, 3
)
select d.id as comprobante_id,
       greatest(0, least(d.total, d.acumulado - coalesce(c.credito, 0)))::numeric(14,2) as pendiente
from deb d
left join cred c on c.tercero = d.tercero and c.es_cliente = d.es_cliente and c.moneda = d.moneda;
