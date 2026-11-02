# Cotización
Propuesta de precio para un [[Prospecto]]. Hoy se guarda como `proyectos` en estado `cotizado` (+ `proyecto_renglones`).
- Manual: monto sin IVA, renglones de costo por rubro (material, herraje, mano de obra, flete, colocación), PDF adjunto (bucket privado `documentos`).
- Automática: [[Cotizador AI]] → `cotizacion_sesiones`, diseño SVG, render, despiece (`cotizacion_piezas`), hojas de placa.
- Validez por defecto: 14 días. Pasa a [[Aprobación]] o se cancela.
