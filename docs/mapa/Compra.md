# Compra
Factura de [[Proveedor]] (`facturas_compra`, `facturas_compra_items`).
- Cada renglón se imputa por cantidad a una o varias [[Orden de trabajo]] (`compra_imputaciones`); lo no imputado queda como stock.
- Ej.: 20 placas ADAC → 4 a OT-005, 16 a OT-006. También "factura completa" a una OT.
- Los precios alimentan [[Insumo]] (precio vigente, en USD al TC del día).
