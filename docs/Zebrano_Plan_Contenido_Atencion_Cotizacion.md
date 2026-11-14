# Zebrano — Contenido, atención y cotización con los agentes

*Diagnóstico y plan · 14/11/2026*

## 1. Cómo está hoy cada agente (verificado en código y base)

| Agente | Qué hace hoy de verdad | Con qué lo hace | Qué le falta |
|---|---|---|---|
| **Lapacho** (redes) | Los lunes arma 3 posts para Instagram/Facebook (lun/mié/vie 19 h) con productos estándar elegidos al azar | Una plantilla fija de texto en `agente-zebrano`; no usa IA, no tiene fotos (los 6 productos tienen `foto_url` vacío) | Cuentas conectadas, banco de imágenes curado, estrategia de contenido, métricas para aprender |
| **Roble** (atención) | Recibe solo lo que entra por la web | Chat del cotizador | Instagram, TikTok y WhatsApp conectados (mensajes y comentarios) |
| **Nogal** (cotizador) | Lee planos, confirma con el taller y cotiza a medida | Cotizador v78 + base de conocimiento (44 trabajos) | Ruta rápida para productos estándar (precio cerrado sin cotizar) |
| **Quebracho** (mercado) | Tiene 42 productos de la competencia con precio del 21/10 | Carga única vía mejorescompras | Credenciales de Mercado Libre para actualizar solo |
| **Cedro** (cierre) | Sin actividad | — | Su ciclo de seguimiento (cotizaciones sin respuesta a los 7 días) |
| **Algarrobo** (prospector) | 89 mails a empresas esperando OK | Prospector + gateway | Casilla de envío |

### Problemas que hay que resolver antes de publicar nada

1. **Los precios de los productos estándar están mal.** El catálogo calcula, por ejemplo, el Bajo mesada 1,20 a **$4.840** y el Rack TV 1,60 a **$6.050**. En Mercado Libre un bajo mesada de 1,40–1,60 cuesta entre $213.000 y $318.000. La vista `productos_estandar_precios` usa `cotizar_modulos()`, que hoy no tiene costos cargados para esos módulos. **Las 9 publicaciones de Lapacho que esperan tu OK tienen esos precios: no hay que aprobarlas.**
2. **Las "skills" no las tienen los agentes.** Las skills de marketing, redes, copywriting y precios están disponibles para mí (Claude) en esta sesión, no para los agentes que corren solos en Supabase. Hay que pasárselas (ver punto 2).
3. **Ninguna red está conectada.** TikTok tiene un token de la app en modo Sandbox, vencido desde junio y con permiso solo de subir borradores. Instagram no tiene nada.

## 2. Cómo les damos las capacidades a los agentes (y cómo aprenden)

Un agente no "tiene" una skill por existir en mi entorno. Para que la use todos los días, la skill tiene que vivir **en su propio sistema**:

- **Tabla `agente_habilidades`**: por agente, el manual de trabajo destilado de las skills (estrategia de contenido, redes y video corto, copywriting, creatividad publicitaria, precios contra competencia, psicología de compra). Lo escribo yo a partir de las skills, adaptado a Zebrano (tono, productos, zona, precios). Se carga en el prompt de cada tarea del agente, igual que hoy `experiencia()` en Nogal.
- **Tabla `contenido_resultados`**: por cada publicación, el alcance, las interacciones, los mensajes que generó y si terminó en venta. Lapacho lee lo que funcionó y lo que no antes de armar la semana siguiente. Esto lo vuelve un aprendizaje real y no una plantilla.
- **Correcciones**: cuando corregís un texto antes de aprobarlo, la diferencia se guarda (igual que `cotizador_aprendizajes`) y el agente la tiene en cuenta la vez siguiente.
- **Revisión mensual**: una vez por mes reviso con las skills completas lo que pasó (qué productos rindieron, qué formatos, qué horarios) y actualizo el manual de `agente_habilidades`.

## 3. Flujo 1 — Generación de contenido (pseudo automático)

1. **Banco de imágenes → curación.** Se suben las fotos (de Drive o arrastrando en `/rrss/importar`). La IA puntúa cada foto: nitidez, luz, encuadre, si se ve un mueble terminado, si hay personas o datos privados. La IA también la etiqueta (tipo de mueble, material, color, ambiente) y la vincula con un producto estándar si corresponde. Vos ves una grilla con las mejores y aprobás de a muchas.
2. **Catálogo estándar con precio que compite.** Para cada producto: costo real, precio, comparación contra los de Mercado Libre del mismo tamaño (Quebracho) y foto aprobada. Solo entran al calendario los productos con precio validado.
3. **Calendario semanal (Lapacho).** Con el manual de habilidades y los resultados anteriores, arma la semana:
   - mezcla de producto estándar, trabajo a medida terminado y proceso de taller;
   - textos por red: Instagram en carrusel o reel, TikTok en foto o video;
   - horarios y hashtags.
4. **Aprobación.** En la Oficina o en Alfred, en lote, por semana. Se puede corregir el texto antes.
5. **Publicación.** En la fecha y hora programadas, por la API de cada red.
6. **Medición.** A las 24 h, a los 3 días y a los 7 días se traen las métricas y se guardan en `contenido_resultados`.

## 4. Flujo 2 — Atención de consultas que genera el contenido

1. Los comentarios y mensajes de Instagram (y de TikTok, según lo que permita su API) entran a Roble y quedan como prospecto, con el post de origen.
2. Roble clasifica la consulta:
   - **Producto estándar**: responde con precio cerrado, plazo y forma de pago, y pide los datos para la seña.
   - **A medida**: junta medidas y fotos y se lo pasa a Nogal.
   - **Otra cosa**: la deriva a una persona.
3. Las respuestas salen con tu OK al principio. Más adelante, las de productos estándar pueden salir solas, porque el precio es cerrado y ya está aprobado.
4. Cedro sigue a los que no contestan y avisa cuando corresponde.

## 5. Flujo 3 — Cotización

- **Estándar**: no se cotiza; se toma el precio del catálogo. Se arma la orden y se pide la seña.
- **A medida**: el flujo actual de Nogal (plano → confirmación del taller → cotización → render → PDF), validado por una persona antes de enviarlo al cliente.
- Todo lo aprobado alimenta la base de conocimiento, como ya pasa hoy.

## 6. Conexión con Instagram y TikTok — qué hace falta

**Instagram** (API de Instagram con inicio de sesión de Instagram)
- La cuenta de Zebrano tiene que ser **profesional** (empresa o creador).
- Una app de Meta para desarrolladores. Si la cuenta tiene un rol en la app, alcanza el acceso estándar para publicar en la cuenta propia.
- Permisos:
  - `instagram_business_basic`
  - `instagram_business_content_publish` (publicar)
  - `instagram_business_manage_messages` (mensajes)
  - `instagram_business_manage_comments` (comentarios)
- Las imágenes tienen que estar en una URL pública y en JPEG. Tope de unas 50–100 publicaciones por API cada 24 h. Admite carrusel, reels e historias.

**TikTok** (Content Posting API)
- Hay que pasar la app de Sandbox a producción y volver a autorizar la cuenta.
- **Mientras la app no esté auditada por TikTok, todo lo publicado por API queda privado.** Hay dos opciones: pedir la auditoría, o subir a borradores y que alguien toque "Publicar" en el teléfono, que es un paso de 10 segundos.
- Se pueden publicar fotos (carrusel) desde URL de un dominio verificado, y también videos.
- Los mensajes directos de TikTok no tienen API pública general. La atención en TikTok se va a apoyar en comentarios y en derivar a WhatsApp o Instagram.

## 7. Cómo se ve en la Oficina, los indicadores y los módulos

- **Indicadores de la Oficina**:
  - publicaciones de la semana (programadas y publicadas);
  - alcance de 7 días;
  - consultas por red;
  - consultas de estándar contra a medida;
  - conversión consulta → venta;
  - ventas de estándar del mes.
- **Tablero por etapas**: las tarjetas de Difundir muestran posts programados, publicados y su resultado. En Atender aparecen las consultas por red. En Cotizar se separan estándar y a medida.
- **Módulos**: `RRSS` (banco curado, calendario, métricas), `Productos estándar` (precio contra Mercado Libre, foto, estado), `Prospectos` (origen = post).

## 8. Orden de ejecución

| Fase | Qué | Depende de |
|---|---|---|
| 0 | Corregir los precios del catálogo estándar contra el costeo real; descartar las 9 publicaciones con precios mal | Nada (yo) |
| 1 | `agente_habilidades` con el manual de contenido, atención y precios; Lapacho usa IA + manual + resultados | Nada (yo) |
| 2 | Curación del banco de imágenes | Que me digas dónde está el banco |
| 3 | Conexión de Instagram (publicar + mensajes + comentarios) | Cuenta profesional y app de Meta (lo armamos juntos; vos ingresás tus credenciales) |
| 4 | Conexión de TikTok en producción (borradores primero; auditoría después) | Tu cuenta de TikTok y el formulario de la app |
| 5 | Flujo de atención con Roble y la ruta rápida de estándar | Fase 3 |
| 6 | Indicadores y tarjetas nuevas en la Oficina y los módulos | Fases 1–5 (se suma a medida que hay datos) |
