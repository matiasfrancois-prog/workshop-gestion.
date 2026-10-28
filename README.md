# Work Shop · Sistema de gestión

App web propia de Work Shop, pensada primero para el celular.
Stack: Next.js (Vercel) + Supabase (base de datos y login).

## Módulos (versión 0.1)

| Módulo | Qué hace |
|---|---|
| Inicio | Ventas de hoy y del mes, total a cobrar, dólar del día, stock bajo, últimos comprobantes |
| Vender | Venta, pedido, presupuesto y devolución. Avisa si el cliente tiene deuda o supera su límite, y si falta stock |
| Productos | Alta y edición, precios por lista (margen % o precio a mano), ajuste de stock, historial de movimientos |
| Clientes | Datos, saldo en **US$ y $ por separado**, cuenta corriente con saldo corrido, cobros, WhatsApp |
| Proveedores | Datos, cuenta corriente, pagos |
| Compras | Ingreso de mercadería. Suma stock y actualiza el costo |
| Comprobantes | Listado con filtros, detalle, envío por WhatsApp (sin costos), convertir presupuesto/pedido en venta, anular |
| Stock | Reponer (≤ 7 días), sin stock con venta, sobrestock, sin rotación |
| Comparador | El comparador actual dentro del sistema |
| Caja | Pesos, Dólares y USDT. Cobros/pagos con recibo, gastos, retiros, aportes, cambios entre cajas |
| IMEI / series | Cada unidad que entra y sale con su número de serie. Escáner, pegar lista o cámara. Buscador con historial |
| Costo real | Promedio ponderado: cada compra recalcula el costo con lo que hay en stock |
| PDF | Comprobantes (A4 y ticket 80mm), recibos y órdenes de pago, guía de despacho, rótulo media A4 con FRÁGIL, resumen de cuenta |
| Configuración | Dólar del día, listas de precios, datos de la empresa |

Roles: **admin** (ve costos y márgenes, anula comprobantes) y **vendedor**.

---

## Puesta en marcha (una sola vez)

### 1. Base de datos (Supabase)
1. Entrá a supabase.com, abrí el proyecto **workshop-gestion**.
2. Menú izquierdo → **SQL Editor** → **New query**.
3. Abrí el archivo `supabase/schema.sql`, copiá todo, pegalo y tocá **Run**. Tiene que decir *Success*.
   Después hacé lo mismo, en orden, con cada migración: `supabase/002_caja_imei_costos.sql`.
4. Menú izquierdo → **Authentication** → **Users** → **Add user** → **Create new user**.
   Poné tu email y una contraseña. Marcá **Auto Confirm User**.
5. Volvé a **SQL Editor**, pegá esta línea cambiando el email, y tocá **Run**:
   ```sql
   update perfiles set rol = 'admin' where id = (select id from auth.users where email = 'TU_EMAIL');
   ```
6. Menú izquierdo → **Project Settings** → **API**. Dejá abierta esa pantalla: vas a copiar
   **Project URL** y la clave **anon public**.

### 2. Publicar (Vercel)
1. Entrá a vercel.com → **Add New…** → **Project**.
2. Elegí el repo **workshop-gestion** → **Import**.
3. Abrí **Environment Variables** y cargá:
   - `NEXT_PUBLIC_SUPABASE_URL` → el Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → la clave anon public
4. Tocá **Deploy**. En 1–2 minutos te da la dirección (ej. `workshop-gestion.vercel.app`).

### 3. En el celular
Abrí la dirección en el navegador → menú → **Agregar a pantalla de inicio**. Queda como una app.

### Usuarios para el equipo
Supabase → Authentication → Add user. Entran como **vendedor**. Para hacer admin a alguien, repetir el paso 1.5 con su email.

---

## Próximas fases
- Importar productos, clientes y saldos desde los export de Cianbox.
- Caja y bancos (unificar con la app de cuenta corriente / RMA).
- Comparador fase 2: precios de proveedores en la base, cruzados con stock y ventas.
- Reportes de margen por producto y por cliente.
