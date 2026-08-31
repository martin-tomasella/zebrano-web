
// ============================================================
// ZEBRANO ERP — Sistema central de Roles y Permisos
// Única fuente de verdad para: sidebar (Layout), protección de
// rutas (App.js) y la matriz visual en /usuarios.
// ============================================================

// ─── Catálogo de roles ──────────────────────────────────────
// key: valor guardado en empleados.rol (texto libre en DB)
export const ROLES = {
  admin: {
    label: 'Administrador',
    descripcion: 'Acceso total. Puede ver, crear, editar y eliminar en todos los módulos, incluyendo la gestión de usuarios y sus roles.',
    color: '#8F2FFE',
  },
  gestion: {
    label: 'Gestión',
    descripcion: 'Acceso total al negocio (ventas, producción, insumos, finanzas y usuarios) excepto el módulo de Marketing / Redes Sociales.',
    color: '#60a5fa',
  },
  carpintero_oficial: {
    label: 'Carpintero Oficial',
    descripcion: 'Rol de taller. Pensado para acceso operativo a Producción, Proyectos, Materiales y registro de Horas de trabajo.',
    color: '#4ade80',
  },
  carpintero: {
    label: 'Carpintero',
    descripcion: 'Rol de taller. Pensado para acceso operativo a Producción, Proyectos, Materiales y registro de Horas de trabajo.',
    color: '#4ade80',
  },
  ayudante: {
    label: 'Ayudante',
    descripcion: 'Rol de taller con acceso más acotado: Producción y registro de Horas de trabajo.',
    color: '#fbbf24',
  },
};

export const ROLES_SELECCIONABLES = Object.keys(ROLES);

// ─── Catálogo de módulos ────────────────────────────────────
// Cada módulo declara su ruta base y a qué categoría pertenece.
// `match` define cómo se compara contra location.pathname.
export const MODULOS = [
  { key:'dashboard',    label:'Dashboard',           path:'/',              categoria:'Principal' },

  { key:'prospectos',   label:'Prospectos',          path:'/prospectos',    categoria:'Ventas' },
  { key:'clientes',     label:'Clientes',            path:'/clientes',      categoria:'Ventas' },
  { key:'cotizador',    label:'Cotizador AI',        path:'/cotizador',     categoria:'Ventas' },
  { key:'proyectos',    label:'Proyectos',           path:'/proyectos',     categoria:'Ventas' },
  { key:'metricas',     label:'Tiempos de ciclo',    path:'/metricas',      categoria:'Ventas' },

  { key:'produccion',      label:'Producción',        path:'/produccion',      categoria:'Producción' },
  { key:'horas_trabajo',   label:'Horas de trabajo',  path:'/horas-trabajo',   categoria:'Producción' },

  { key:'proveedores',  label:'Proveedores',         path:'/proveedores',   categoria:'Insumos' },
  { key:'materiales',   label:'Materiales',          path:'/materiales',    categoria:'Insumos' },

  { key:'finanzas',     label:'Finanzas',             path:'/finanzas',      categoria:'Administración' },
  { key:'usuarios',     label:'Usuarios',             path:'/usuarios',      categoria:'Administración' },
  { key:'landing',      label:'Landing pública',      path:'/landing',       categoria:'Administración' },

  { key:'tiktok',           label:'TikTok',            path:'/tiktok',           categoria:'Marketing' },
  { key:'rrss',              label:'Instagram / FB',    path:'/rrss',             categoria:'Marketing' },
  { key:'rrss_importar',    label:'Importar fotos',    path:'/rrss/importar',   categoria:'Marketing' },
];

export const CATEGORIAS_ORDEN = ['Principal','Ventas','Producción','Insumos','Administración','Marketing'];

// ─── Matriz de permisos: rol → set de module keys permitidos ─
// admin: acceso implícito a todo (se resuelve aparte, no listamos todo acá)
const PERMISOS_POR_ROL = {
  // gestion: todo excepto Marketing (tiktok, rrss, rrss_importar)
  gestion: MODULOS.filter(m => m.categoria !== 'Marketing').map(m => m.key),

  // Roles de taller: acceso operativo acotado
  carpintero_oficial: ['dashboard','produccion','proyectos','materiales','horas_trabajo'],
  carpintero:         ['dashboard','produccion','proyectos','materiales','horas_trabajo'],
  ayudante:           ['dashboard','produccion','horas_trabajo'],
};

// ─── Helpers ─────────────────────────────────────────────────

/** Devuelve el array de module keys permitidos para un rol dado. */
export function modulosPermitidos(rol) {
  if (rol === 'admin') return MODULOS.map(m => m.key);
  return PERMISOS_POR_ROL[rol] || [];
}

/** ¿Este rol puede acceder al módulo indicado por su key? */
export function tieneAcceso(rol, moduloKey) {
  if (rol === 'admin') return true;
  return modulosPermitidos(rol).includes(moduloKey);
}

/** Busca el módulo cuyo path coincide con un pathname de router (match por prefijo, el más específico primero). */
export function moduloPorPath(pathname) {
  const candidatos = MODULOS
    .filter(m => m.path === '/' ? pathname === '/' : pathname.startsWith(m.path))
    .sort((a, b) => b.path.length - a.path.length);
  return candidatos[0] || null;
}

/** ¿Este rol puede acceder a esta URL (pathname) del router? */
export function puedeAccederRuta(rol, pathname) {
  const modulo = moduloPorPath(pathname);
  if (!modulo) return true; // rutas no catalogadas (ej. detalle /prospectos/:id ya matchea por prefijo /prospectos)
  return tieneAcceso(rol, modulo.key);
}

/** Primera ruta a la que este rol sí tiene acceso — útil para redirigir tras un intento inválido. */
export function primeraRutaPermitida(rol) {
  if (rol === 'admin') return '/';
  const permitidos = modulosPermitidos(rol);
  if (permitidos.includes('dashboard')) return '/';
  const primero = MODULOS.find(m => permitidos.includes(m.key));
  return primero ? primero.path : '/login';
}
