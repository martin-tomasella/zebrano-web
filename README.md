# Zebrano ERP Web

Sistema de gestión interno para Zebrano — carpintería y mueblería premium a medida.

## Stack

- **Frontend**: React 18 + React Router
- **Backend/DB**: Supabase (PostgreSQL + Auth)
- **Agente AI**: Claude (via n8n webhooks)
- **Hosting recomendado**: Vercel (deploy automático desde GitHub)

## Páginas

| Ruta | Descripción |
|------|-------------|
| `/` | Dashboard con KPIs, proyectos activos y seguimientos |
| `/proyectos` | Lista completa de trabajos con filtros por estado |
| `/clientes` | Base de clientes con historial y facturación |
| `/ventas` | Pipeline kanban de oportunidades |
| `/produccion` | OTs activas con barras de avance |
| `/cotizador` | Chat con el agente AI cotizador |
| `/landing` | Preview de la landing pública |

## Instalación local

```bash
git clone https://github.com/martin-tomasella/zebrano
cd zebrano-web
cp .env.example .env
# Completar .env con las keys reales
npm install
npm start
```

## Variables de entorno

```
REACT_APP_SUPABASE_URL=
REACT_APP_SUPABASE_ANON_KEY=
REACT_APP_N8N_COTIZADOR=
REACT_APP_N8N_LEADER=
```

## Deploy en Vercel

1. Push a GitHub
2. Importar repo en vercel.com
3. Agregar variables de entorno en el panel de Vercel
4. Deploy automático en cada push a `main`

## Auth

Usa Supabase Auth. Los usuarios se crean en el panel de Supabase (Authentication > Users).
La tabla `empleados` tiene un campo `auth_user_id` que linkea el usuario al perfil.

### Crear usuario admin

1. Ir a Supabase → Authentication → Add user
2. Email: `martin@zebrano.com`, password a elección
3. Copiar el UUID del usuario creado
4. Ejecutar en SQL:

```sql
UPDATE empleados SET auth_user_id = 'UUID-AQUI' WHERE nombre = 'Jorge Ramírez';
```

O insertar nuevo empleado:

```sql
INSERT INTO empleados (nombre, rol, costo_hora, auth_user_id)
VALUES ('Martín Tomasella', 'admin', 0, 'UUID-AQUI');
```

## Estructura del proyecto

```
zebrano-web/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── Layout.jsx      # Sidebar + Topbar
│   │   └── ui.jsx          # Badge, Table, Card, KpiCard...
│   ├── hooks/
│   │   └── useAuth.js      # Auth context con Supabase
│   ├── lib/
│   │   └── supabase.js     # Cliente Supabase + constantes
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Proyectos.jsx
│   │   ├── Clientes.jsx
│   │   ├── Ventas.jsx
│   │   ├── Produccion.jsx
│   │   ├── Cotizador.jsx
│   │   └── Landing.jsx
│   ├── App.js
│   ├── index.js
│   └── index.css
├── .env.example
├── .gitignore
└── package.json
```
