# Zebrano — Sitio Web

## Deploy en Vercel (5 minutos)

### Paso 1: Subir a GitHub
```bash
# Crear repo nuevo en github.com/nuevo
git init
git add .
git commit -m "feat: sitio Zebrano v1.0"
git remote add origin https://github.com/TU_USUARIO/zebrano-web.git
git push -u origin main
```

### Paso 2: Conectar con Vercel
1. Ir a https://vercel.com
2. "Add New Project"
3. Importar el repo `zebrano-web`
4. Click "Deploy" — no necesita variables de entorno (la Edge Function URL está en el código)
5. En ~30 segundos tenés el sitio online con HTTPS automático

### Paso 3: Dominio personalizado (opcional)
- En Vercel: Settings → Domains → Add Domain
- Si tenés Hostinger: apuntá el DNS del dominio a Vercel

---

## Archivos incluidos

| Archivo | Descripción |
|---------|-------------|
| `index.html` | Landing page con formulario de contacto |
| `vercel.json` | Headers de seguridad (CSP, HSTS, X-Frame-Options) |
| `erp-roble.html` | ERP interno — módulo Roble (abrir localmente o subir a ruta protegida) |

---

## Seguridad implementada

✅ HTTPS automático (Vercel)  
✅ Headers de seguridad (CSP, HSTS, X-Frame-Options, X-XSS-Protection)  
✅ Honeypot anti-spam en el formulario  
✅ Rate limiting client-side (3 envíos máx por sesión)  
✅ Rate limiting server-side en Edge Function (10 req/min por IP)  
✅ Validación de inputs (nombre, email, longitud)  
✅ La anon key de Supabase nunca se expone — el formulario llama a la Edge Function  
✅ La Edge Function usa service_role internamente  
✅ RLS activo en todas las tablas  

---

## Flujo Roble → Nogal

```
Prospecto llena formulario web
        ↓
Edge Function roble-ventas analiza con Claude
        ↓
Crea oportunidad en tabla oportunidades
        ↓
Si listo_para_cotizar = true:
  → Crea cotizacion_sesion automáticamente
  → Nogal puede continuar desde la app
        ↓
Si necesita seguimiento:
  → Aparece en ERP (erp-roble.html) con temperatura
  → El equipo hace seguimiento manual
  → Cuando confirma, click "→ Pasar a Nogal"
```

---

## Google Drive de fotos (pendiente)

Cuando tengas el link del Drive, ir a Supabase → tabla `zebrano_drive_config` y completar:
- `drive_folder_id`: el ID de la carpeta (lo que viene después de /folders/ en la URL)
- `drive_folder_url`: la URL completa

El agente Nogal ya está preparado para consultar la base de conocimiento de trabajos anteriores.
Para agregar fotos del Drive a la base de conocimiento: insertar en tabla `conocimiento_fotos` con la URL pública de cada foto.
