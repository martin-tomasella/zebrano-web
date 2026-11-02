---
tipo: indice
actualizado: 2026-11-02
---
# Mapa Zebrano

Vault de Obsidian del ERP de Zebrano. Cada nota es una entidad o un proceso; los `[[enlaces]]` son las relaciones.
Pensado para personas y para agentes (Theron, Alfred, agente Zebrano): leer esta nota primero.

## Flujo comercial (de punta a punta)
[[Prospecto]] → [[Cotización]] → [[Aprobación]] → [[Orden de trabajo]] → [[Entrega]] → [[Rentabilidad]]

- Todo trabajo nace como [[Prospecto]], sea manual (carga en el ERP) o automático (web, RRSS, [[Cotizador AI]]).
- Un prospecto se asocia a un [[Cliente]] nuevo o existente (un cliente puede tener muchos prospectos/pedidos).
- La [[Cotización]] puede ser manual (monto + renglones) o del [[Cotizador AI]] (diseño, render, despiece).
- La [[Aprobación]] del cliente dispara la [[Orden de trabajo]] con despiece, materiales y horas estimadas.
- Al taller (lista, Gantt, calendario) solo entran órdenes aprobadas, con fecha de entrega.
- A cada orden se imputan [[Compra]] (por renglón), [[Gasto]] (flete, colocación, herrajes), [[Horas]] y [[Cobro]].
- Al entregar, la [[Rentabilidad]] compara lo cotizado con lo real.

## Entidades
- [[Cliente]] · [[Prospecto]] · [[Cotización]] · [[Orden de trabajo]] · [[Compra]] · [[Gasto]] · [[Horas]] · [[Cobro]] · [[Proveedor]] · [[Insumo]]

## Agentes e integraciones
- [[Cotizador AI]] (Nogal) · [[Seguridad]]

## Datos en vivo
Pendiente: vista `mapa_relaciones` en Supabase con el grafo en vivo (cliente → proyecto → OT → compras/gastos/cobros).
