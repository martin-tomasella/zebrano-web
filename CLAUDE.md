
<!-- karpathy-guidelines:start -->
## Reglas de trabajo para agentes y Claude (basadas en karpathy-guidelines, MIT)

Fuente: https://github.com/multica-ai/andrej-karpathy-skills — adaptadas para trabajo autónomo.

### 1. Pensar antes de programar
- No asumir en silencio. Si hay ambigüedad, elegir la interpretación más razonable, **declarar el supuesto en el resultado** y seguir.
- Detenerse y preguntar solo si el cambio es irreversible o destructivo (borrar datos, migraciones que pierden información, cambios en producción que no se pueden revertir).
- Si existe un enfoque más simple que el pedido, decirlo.

### 2. Simplicidad primero
- El mínimo código que resuelve el problema. Nada especulativo.
- Sin funciones, abstracciones, configurabilidad ni manejo de errores para escenarios imposibles que nadie pidió.
- Si 200 líneas pueden ser 50, reescribir.

### 3. Cambios quirúrgicos
- Tocar solo lo necesario. **Nunca reescribir un archivo entero para un cambio chico**: editar solo las líneas afectadas.
- No "mejorar" código, comentarios ni formato vecinos. Respetar el estilo existente.
- Si se ve código muerto no relacionado, mencionarlo; no borrarlo.
- Eliminar solo lo que los propios cambios dejaron sin uso.
- Prueba: cada línea cambiada tiene que responder directamente al pedido.

### 4. Ejecución por objetivos
- Convertir el pedido en un criterio verificable ("arreglar el bug" → "test que lo reproduce, y hacerlo pasar").
- En tareas de varios pasos, plan breve con verificación por paso:
  1. [paso] → verificar: [chequeo]
- No dar por terminado algo que no se verificó.

En tareas triviales (typos, cambios de una línea) usar criterio: no hace falta todo el rigor.
<!-- karpathy-guidelines:end -->
