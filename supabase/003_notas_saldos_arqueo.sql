-- =====================================================================
-- WORK SHOP · Migración 003
--   · Notas de crédito y notas de débito de clientes y proveedores
--     (sin mercadería: descuentos, diferencias de precio o de cambio,
--      intereses, saldo inicial de cuenta corriente).
--   · Saldo inicial de caja.
--   · Arqueo de caja: cargás lo que contaste y el sistema ajusta la diferencia.
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar todo → Run.
-- Se corre UNA sola vez, después de 002.
-- =====================================================================

-- Número con formato argentino: 1.234.567,89
create or replace function fmt_ar(n numeric) returns text
language sql immutable as $$
  select translate(to_char(n, 'FM999,999,999,990.00'), ',.', '.,');
$$;

-- ---------- Notas de débito ----------
alter type tipo_comprobante add value if not exists 'nd_venta';   -- suma deuda al cliente
alter type tipo_comprobante add value if not exists 'nd_compra';  -- suma deuda con el proveedor

-- El control de cliente/proveedor según el tipo de comprobante
alter table comprobantes drop constraint if exists comprobantes_check;
alter table comprobantes add constraint comprobantes_tercero_check check (
  (tipo::text in ('presupuesto','pedido','venta','nc_venta','nd_venta') and cliente_id is not null and proveedor_id is null) or
  (tipo::text in ('compra','nc_compra','nd_compra') and proveedor_id is not null and cliente_id is null)
);

-- Cuenta corriente: las ND suman, las NC restan
create or replace view ctacte_clientes with (security_invoker = on) as
select cliente_id, moneda, fecha, 'comprobante'::text as origen, id as origen_id, tipo::text as concepto, numero,
       case when tipo::text in ('venta','nd_venta') then total else -total end as importe
from comprobantes
where tipo::text in ('venta','nc_venta','nd_venta') and estado = 'confirmado'
union all
select p.cliente_id, p.moneda, p.fecha, 'pago', p.id,
       'Recibo · ' || c.nombre || case when c.moneda::text <> p.moneda::text then ' ' || fmt_ar(p.importe_caja) else '' end,
       p.numero, -p.importe
from pagos p join cajas c on c.id = p.caja_id
where p.cliente_id is not null and not p.anulado;

create or replace view ctacte_proveedores with (security_invoker = on) as
select proveedor_id, moneda, fecha, 'comprobante'::text as origen, id as origen_id, tipo::text as concepto, numero,
       case when tipo::text in ('compra','nd_compra') then total else -total end as importe
from comprobantes
where tipo::text in ('compra','nc_compra','nd_compra') and estado = 'confirmado'
union all
select p.proveedor_id, p.moneda, p.fecha, 'pago', p.id,
       'Orden de pago · ' || c.nombre || case when c.moneda::text <> p.moneda::text then ' ' || fmt_ar(p.importe_caja) else '' end,
       p.numero, -p.importe
from pagos p join cajas c on c.id = p.caja_id
where p.proveedor_id is not null and not p.anulado;

-- Nota de crédito o débito sin mercadería (un solo renglón con el concepto)
create function nota_cuenta(
  p_tipo text,             -- nc_venta, nd_venta, nc_compra, nd_compra
  p_cliente_id bigint,
  p_proveedor_id bigint,
  p_moneda moneda,
  p_importe numeric,
  p_concepto text,
  p_fecha date default current_date
) returns bigint
language plpgsql security invoker set search_path = public as $$
declare v_id bigint;
begin
  if p_tipo not in ('nc_venta','nd_venta','nc_compra','nd_compra') then raise exception 'Tipo de nota inválido'; end if;
  if coalesce(p_importe, 0) <= 0 then raise exception 'El importe tiene que ser mayor a cero'; end if;
  v_id := registrar_comprobante(
    p_tipo::tipo_comprobante, p_cliente_id, p_proveedor_id, p_moneda,
    jsonb_build_array(jsonb_build_object('producto_id', null, 'descripcion', coalesce(nullif(trim(p_concepto), ''), 'Ajuste de cuenta'), 'cantidad', 1, 'precio_unit', p_importe)),
    null, null);
  if p_fecha is not null and p_fecha <> current_date then
    update comprobantes set fecha = p_fecha where id = v_id;
  end if;
  return v_id;
end $$;

-- ---------- Caja: saldo inicial y arqueo ----------
alter table movimientos_caja drop constraint if exists movimientos_caja_tipo_check;
alter table movimientos_caja add constraint movimientos_caja_tipo_check
  check (tipo in ('cobro','pago','gasto','retiro','aporte','transferencia','ajuste','saldo_inicial','arqueo'));

-- Fija el saldo de una caja: registra la diferencia entre lo que hay en el sistema y lo real.
--   p_tipo = 'saldo_inicial' (arranque) o 'arqueo' (control / conteo)
create function fijar_saldo_caja(p_caja_id bigint, p_saldo_real numeric, p_tipo text, p_concepto text, p_fecha date default current_date)
returns numeric
language plpgsql security invoker set search_path = public as $$
declare v_actual numeric; v_dif numeric;
begin
  if not es_equipo() then raise exception 'Sin permiso'; end if;
  if p_tipo not in ('saldo_inicial','arqueo') then raise exception 'Tipo inválido'; end if;
  select coalesce(sum(importe), 0) into v_actual from movimientos_caja where caja_id = p_caja_id and not anulado;
  v_dif := round(coalesce(p_saldo_real, 0) - v_actual, 2);
  if v_dif <> 0 then
    insert into movimientos_caja (fecha, caja_id, importe, tipo, concepto)
    values (coalesce(p_fecha, current_date), p_caja_id, v_dif, p_tipo,
            coalesce(nullif(trim(p_concepto), ''), case when p_tipo = 'saldo_inicial' then 'Saldo inicial' else 'Arqueo de caja' end)
            || ' (sistema ' || fmt_ar(v_actual) || ' → real ' || fmt_ar(p_saldo_real) || ')');
  end if;
  return v_dif;
end $$;
