# Changelog

## 10/11/2026
- **ERP v2, fases 2 a 7.**
  - Órdenes: cada OT tiene "Corte de placas" (optimizador en guillotina, sierra de 4 mm, sin girar las melaminas con veta, dibujo por placa, aprovechamiento y retazos) con hoja de corte imprimible, y "Materiales y compras".
  - Compras y stock: al crearse una OT se calculan sus necesidades (placas, cantos, herrajes) desde la cotización (`ot_necesidades`). Por renglón se decide comprar o usar stock; "Usar" descuenta el stock. El stock (`stock_movimientos`, vista `stock_actual`) suma las facturas con insumo identificado desde hoy, resta lo que usan las OT y se corrige con el conteo físico. Pestañas nuevas en Compras: Necesidades de OT y Stock.
  - Horas de trabajo: planificación de la cola con horas-persona por etapa (`ot_etapas`). Al cambiar las personas se recalcula la duración y la fecha de fin de esa OT y de las siguientes (jornada de 7 h, lunes a viernes, una OT por vez), y se guarda en la OT. Muestra las horas reales cargadas por etapa.
  - Clientes: ficha con obras y sus trabajos, cotizaciones (versión, precio, cierre, descuento, USD del día) y vendido, cobrado y saldo. Botón "Nuevo trabajo" desde el cliente, la obra, el prospecto y el proyecto.
  - Prospección: bandeja de mails para aprobar, editar o descartar, y "Respondió → Prospecto". Sin casilla conectada no se envía nada.
  - Mercado: "Dónde conviene competir", con el margen real mediano por categoría.
- Cotizador v66: `guardar_diseno` no modifica una cotización aprobada ni guarda una tabla vacía.
- **Cotizador v65 (núcleo del ERP v2).** Flujo por pasos para el "Nuevo trabajo": `leer` (plano, foto, bosquejo o medidas → módulos, mano de obra y estilo), `guardar_diseno` (tabla de módulos editada → plano SVG), `render` (con "pedir cambio"), `cotizar` y `aprobar_cotizacion`. Solo empleados (la clave pública recibe 401). El precio sale también en USD con el oficial BCRA del día (`cotizacion_resumen.tc_usd` y `precio_usd`, y una línea en el presupuesto de `zebrano-documentos` v4). Al aprobar, el trabajo queda dentro de una obra (nueva o la elegida), la OT entra en cola sin fecha y el prospecto pasa a ganado. Incluye v64.
- **Obras.** Tabla `obras`: una obra (lugar) agrupa varios trabajos (`proyectos.obra_id`). Los 23 proyectos existentes quedaron con una obra cada uno.
- Publicación del cotizador: la función en Supabase importa el código de este repo en un commit fijo, así lo deployado es exactamente lo versionado.
- Mercado: el relevamiento corre los lunes a las 2 am.
- Diseño Glass v6: foto de fondo (cocina a medida, Unsplash), paneles de vidrio esmerilado, menú lateral y barra superior flotantes, contenido en un panel de vidrio, tarjetas que se elevan al pasar el mouse y el primer indicador del Inicio destacado. También en el login y en el tema oscuro.

## 04/11/2026
- Usuarios: el administrador puede cambiar la contraseña de cualquier usuario (botón "Cambiar clave"; mínimo 8 caracteres). Lo hace `crear-usuario-admin` v4 con la acción `cambiar_password`, que valida que quien llama sea admin activo.
- **Tickets desde la app.** Caja chica muestra la OT y la foto del ticket (`caja_chica.comprobante_path`, bucket privado `facturas`). `zebrano-facturas` v9 exige empleado activo (antes alcanzaba con tener sesión).
- **Cola de fabricación.** Una OT aprobada queda en cola (`pendiente`) sin fecha de inicio; en Producción se ordena con ▲▼ (`prioridad`) y se le da el OK "Iniciar fabricación": recién ahí corre el tiempo (`iniciada_at`) y el proyecto pasa a En fabricación. Las tarjetas muestran días y horas transcurridos frente a las horas estimadas, y el avance se carga desde el detalle. Funciones `ot_iniciar`, `ot_reordenar`, `ot_avance` y `ot_entregar`, solo admin y gestión. "Iniciar fabricación" en Proyectos usa el mismo camino. Trigger `ot_en_cola_sin_fecha`: el cotizador ya no deja la fecha de aprobación como inicio. El rol gestión ahora ve las OT.
- Seguridad: el registro de usuarios de Supabase estaba abierto y 51 políticas (más 4 de storage) solo pedían "usuario con sesión": cualquiera podía crearse una cuenta con la clave pública y leer clientes, proyectos, facturas, costos y márgenes. Ahora exigen empleado activo (`es_empleado()`). Lo mismo para las funciones del prospector y del relevamiento de mercado y la vista `personal_nombres`. Desactivadas `supabase-secrets-setter` y `vercel-env-updater` (pasarelas abiertas sin uso).
- Cotizador v63: hora hombre de cotización $16.200 (`cotiz_parametros.hora_hombre_cotizacion`), calibrada para que la Cocina A de FORNES (6039) dé el precio de la planilla vieja ($1.988.000). El fibro de fondos no lleva el 80% de aprovechamiento.
- Cotizador v62: herrajes con los precios de la planilla del taller (octubre); suma cantos (rollos de preencolado por metro de canto), tiradores (uno por puerta y cajón) y varios (placas + 1) como el cómputo; bisagra cierre suave y pata de cocina por defecto. Validado contra la Cocina A de 6039: placas, preencolado, bisagras, correderas, patas y tiradores iguales al cómputo real.
- Cotizador v60: el nombre y contacto del cliente se guardan en cualquier etapa y un paso sin datos ya no los borra (la OT salía como "Cliente cotizador OT-…"). Las tipologías de placard/vestidor solo se usan en placares, vestidores y dormitorios (no en cocinas ni baños). No vuelve a preguntar frentes, zócalo/patas, terminaciones o regrueso si el usuario ya lo dijo. El plano de una cocina se dibuja en dos filas: alacenas arriba y bajos abajo.
- Cotizador (web): botones "Presupuesto (PDF)" y "Hoja de taller (PDF)" con link firmado, links del chat clickeables y "Ver plano técnico" abre el SVG.

## 03/11/2026
- Cotizador v59: el flujo se respeta en código: si el agente quiere cotizar sin plano aprobado, primero muestra el plano con los módulos leídos; aprobado el plano se genera el render y recién después el presupuesto (se puede saltear diciendo "sin render"). Presupuesto numerado desde v1. `zebrano-documentos` v2: presupuesto y hoja de taller en PDF (Storage mostraba el HTML como texto).
- Cotizador v58: aprovechamiento de placa 80% (`cotiz_parametros.aprovechamiento_placa`) y placas de melamina 18 mm en 2750x1830. Despiece: laterales de terminación (por lateral a la vista) y regrueso de mesada opcional; el agente los sugiere.
- Flujo completo: cada cotización genera un presupuesto versionado (v1, v2…) con el formato y condiciones de las ofertas de Zebrano; al aprobar se crea la OT, queda pendiente en Producción y se genera la hoja de taller (módulos, herrajes, tiempos por etapa y despiece). Nueva función `zebrano-documentos` (HTML imprimible en el bucket privado `documentos`, link firmado 7 días; solo service role o empleado).
- Cotizador v57: despiece por reglas del taller (`despiece.ts`). El agente describe los módulos (familia, ancho, alto, profundidad de casco, puertas, cajones, estantes, frentes, zócalo/patas) y el sistema calcula piezas, bisagras y correderas: base y techo sobre/bajo laterales, travesaños en bajos, fondo fibro 3 mm clavado, luz 3 mm, frentes superpuestos (o embutidos si se indica), bisagras 2/3/4 según alto de puerta, cajones en 18 mm con fondo fibro y lateral según el frente. Si no se dijo, pregunta frentes superpuestos/embutidos y zócalo/patas.
- Tabla `tipologias_taller`: las 57 tipologías de la planilla de cómputo (Int A–L, Vest, PC, frentes, módulos, escritorios, etc.) con sus cantidades (placas blancas, preencolado, fondo, herrajes) y 3 coeficientes de placas blancas por ml de frente (cocina, placard, vanitory) sacados de 58 presupuestos 2026.
- Cotizador v55: el agente ve las tipologías y marca cuál usa (`tipologias_ref`); en canal interno avisa "Control del taller" si el despiece se aparta más de 30% de la tipología o sale del rango de placas por ml de 2026. Las horas y personas que indica el usuario mandan sobre la estimación del agente.
- Cotizador v56: la tipología se elige por el ancho medido (dentro del mismo grupo y variante abrir/corrediza), no por el nombre que propone el modelo. En canal interno muestra qué tipología usó y cuántas placas tiene en la planilla.

## 02/11/2026 (tarde)
- Cotizador v54: la melamina blanca (Melamina blanco mate 18mm, $54.564 al 02/11) es la base. Toda placa de melamina se calcula a precio de blanca; si el color es más caro, la diferencia va aparte como "Adicional por color" (pasada por la fórmula de precio). Si un color figura más barato que la blanca (precio viejo), se cobra como blanca y se avisa. `cotizador_catalogo.precio_al_dia`: factura o precio de lista cargado hace menos de 60 días.
- Cotizador v53: precios reales. Placas y herrajes salen de `cotizador_catalogo` (última factura confirmada, llevada a hoy por dólar BCRA; si no hay factura, precio de lista marcado como desactualizado). El modelo ya no ve precios: el sistema calcula y escribe el precio.
- Mano de obra por etapa (corte, canteado, armado, terminación, instalación) con horas y personas; corte siempre 2 personas. Costo = horas × personas × costo hora MO de Personal. Precio con la fórmula del Excel (`precio_venta`, `cotiz_parametros`).
- Catálogo único: las placas y herrajes de `config_placas`/`config_herrajes` pasaron a `insumos` (con medidas de placa).
- Compras: al confirmar una factura, si un insumo ya tiene precio de otro proveedor pregunta cuál tomar (`insumos.proveedor_preferido_id`, función `conflictos_proveedor`).
- Cotizador: botón "Subir factura de compra" (mismo circuito que Compras).

## 02/11/2026
- Seguridad: `zebrano-leader` v22 cerrada (antes abierta: resumen operativo, avance de OT y gasto de Claude sin credenciales).
- Cotizador v52: render con varios proveedores (gpt-image-1 → dall-e-3 → Gemini Image → Pollinations) y guardado en Storage; se puede cotizar sin render. Antes fallaba siempre (gpt-image-1 no habilitado en la cuenta de OpenAI).
- `docs/mapa/`: vault de Obsidian con el flujo comercial y las entidades, para personas y agentes (Theron).
- Preparada (pendiente de aprobación): migración de endurecimiento (clave pública sin acceso a tablas, storage, precios internos, cron con llave interna, estados OAuth).

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
