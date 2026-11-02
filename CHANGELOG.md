# Changelog

## 01/11/2026
- **Flujo manual completo**: botón "Nueva cotización" en Proyectos (cliente nuevo o existente, monto sin IVA, renglones de costo por rubro, presupuesto adjunto, trabajos históricos). "Nuevo cliente" en Clientes.
- **Estado Aprobado** entre Cotizado y Seña: al aprobar se fija el precio vendido y se genera la OT (`aprobar_proyecto`, `generar_ot`).
- **Imputación de compras por renglón** (`compra_imputaciones`): cada renglón de factura se reparte entre OT por cantidad; botón "Imputar completa"; lo no imputado queda como stock. Trigger impide imputar más de lo facturado.
- **Gastos y cobros por obra**: `caja_chica.ot_id`, `finanzas_movimientos.ot_id`, `pagos.proyecto_id`. Desde la ficha del proyecto se cargan gastos (flete, herrajes, colocación) y cobros.
- **Rentabilidad**: `proyecto_costos` suma imputaciones + gastos + horas × costo hora y muestra cotizado vs real, cobrado y saldo. `proyecto_materiales`: necesario vs comprado.
- Prospectos: registrar una compra crea el proyecto aprobado con su OT; los pagos quedan en el proyecto.
- Históricos: 44 cotizaciones de la base de conocimiento convertidas en 17 proyectos históricos (14 clientes) en estado Cotizado, para marcar cuáles se ganaron. Excluidos de tiempos de ciclo.
- **Seguridad del cotizador** (`zebrano-cotizador` v51): sin empleado / x-kb-secret / service role el llamado es anónimo → canal externo, no aprueba cotizaciones, topes (1.500 caracteres, 3 imágenes, 20 mensajes por sesión, 3 sesiones por IP por día, 150 llamadas externas por día, 2 renders por sesión). Consumo registrado en `ia_consumo`. La web manda el token de sesión.

## 26/05/2026
- RLS completado con políticas por rol (admin, ventas, carpintero)
- REACT_APP_SUPABASE_ANON_KEY actualizada en Vercel
- Funciones helper `get_mi_rol()` y `es_admin()` creadas en Supabase
