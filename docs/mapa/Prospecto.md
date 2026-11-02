# Prospecto
Punto de convergencia entre lo manual y lo automático. Tabla `prospectos` (+ `oportunidades` como etapa del funnel).
- Entradas: carga manual en el ERP, formulario web, RRSS ([[Seguridad]]: webhook con `x-kb-secret`), prospección.
- Se vincula a un [[Cliente]] existente o crea uno nuevo.
- Datos: tipo de mueble, medidas, materiales, ubicación, plazo, presupuesto del cliente, contacto.
- Avanza a [[Cotización]] (manual o [[Cotizador AI]]).
- Estados: nuevo → contactado → cotizando → propuesta enviada → ganado / perdido.
