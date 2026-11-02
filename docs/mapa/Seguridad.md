# Seguridad
- Sin API keys en el frontend. Toda función no pública valida: empleado con sesión, `x-kb-secret` (`public.kb_sync_secret()`) o service role.
- La clave pública (anon) no lee tablas: todo pasa por funciones.
- Detalle y pendientes: doc del proyecto `claude/seguridad-costos-ia.md`.
