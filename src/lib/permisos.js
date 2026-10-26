// ============================================================
// ZEBRANO ERP -- Sistema central de Roles y Permisos
// Unica fuente de verdad para: sidebar (Layout), proteccion de
// rutas (App.js) y la matriz visual en /usuarios.
// ============================================================

// --- Catalogo de roles ---
// key: valor guardado en empleados.rol (texto libre en DB)
export const ROLES = {
  admin: {
    label: 'Administrador',
    descripcion: 'Acceso total. Puede ver, crear, editar y eliminar en todos los modulos, incluyendo la gestion de usuarios y sus roles.',
    color: '#6D4AD6',
  },
  gestion: {
    label: 'Gestion',
    descripcion: 'Acceso total al negocio (ventas, produccion, insumos, finanzas y usuarios) excepto el modulo de Marketing / Redes Sociales.',
    color: '#2563D6',
  },
  carpintero_oficial: {
    label: 'Carpintero Oficial',
    descripcion: 'Rol de taller. Pensado para acceso operativo a Produccion, Proyectos, Materiales y registro de Horas de trabajo.',
    color: '#1A854A',
  },
  carpintero: {
    label: 'Carpintero',
    descripcion: 'Rol de taller. Pensado para acceso operativo a Produccion, Proyectos, Materiales y registro de Horas de trabajo.',
    color: '#1A854A',
  },
  ayudante: {
    label: 'Ayudante',
    descripcion: 'Rol de taller con acceso mas acotado: Produccion y registro de Horas de trabajo.',
    color: '#B4700E',
  },
};

export const ROLES_SELECCIONABLES = Object.keys(ROLES);

// --- Catalogo de modulos ---
// Cada modulo declara su ruta base y a que categoria pertenece.
// `match` define como se compara contra location.pathname.
export const MODULOS = [
  { key:'dashboard',    label:'Dashboard',           path:'/',              categoria:'Principal' },

  { key:'prospectos',   label:'Prospectos',          path:'/prospectos',    categoria:'Ventas' },
  { key:'clientes',     label:'Clientes',            path:'/clientes',      categoria:'Clientes y mercado' },
  { key:'cotizador',    label:'Cotizador AI',        path:'/cotizador',     categoria:'Ventas' },
  { key:'cotizador_modular', label:'Cotizar por módulos', path:'/cotizar-modulos', categoria:'Ventas' },
  { key:'mercado',      label:'Mercado',             path:'/mercado',       categoria:'Clientes y mercado' },
  { key:'proyectos',    label:'Proyectos',           path:'/proyectos',     categoria:'Ventas' },
  { key:'metricas',     label:'Tiempos de ciclo',    path:'/metricas',      categoria:'Clientes y mercado' },

  { key:'produccion',      label:'Produccion',        path:'/produccion',      categoria:'Produccion' },
  { key:'ordenes',         label:'Órdenes de fabricación', path:'/ordenes', categoria:'Produccion' },
  { key:'horas_trabajo',   label:'Horas de trabajo',  path:'/horas-trabajo',   categoria:'Produccion' },

  { key:'compras',      label:'Compras',             path:'/compras',       categoria:'Insumos' },
  { key:'proveedores',  label:'Proveedores',         path:'/proveedores',   categoria:'Insumos' },
  { key:'materiales',   label:'Materiales',          path:'/materiales',    categoria:'Insumos' },

  { key:'personal',     label:'Personal y estructura', path:'/personal',    categoria:'Administracion' },
  { key:'finanzas',     label:'Finanzas',             path:'/finanzas',      categoria:'Administracion' },
  { key:'usuarios',     label:'Usuarios',             path:'/usuarios',      categoria:'Administracion' },
  { key:'landing',      label:'Landing publica',      path:'/landing',       categoria:'Marketing' },

  { key:'tiktok',           label:'TikTok',            path:'/tiktok',           categoria:'Marketing' },
  { key:'rrss',              label:'Instagram / FB',    path:'/rrss',             categoria:'Marketing' },
  { key:'rrss_importar',    label:'Importar fotos',    path:'/rrss/importar',   categoria:'Marketing' },
];

export const CATEGORIAS_ORDEN = ['Principal','Ventas','Clientes y mercado','Produccion','Insumos','Administracion','Marketing'];

// --- Matriz de permisos: rol -> set de module keys permitidos ---
// admin: acceso implicito a todo (se resuelve aparte, no listamos todo aca)
const PERMISOS_POR_ROL = {
  // gestion: todo excepto Marketing y Administracion (por ahora)
  gestion: MODULOS.filter(m => m.categoria !== 'Marketing' && m.categoria !== 'Administracion').map(m => m.key),

  // Roles de taller: acceso operativo acotado
  carpintero_oficial: ['dashboard','produccion','ordenes','proyectos','materiales','horas_trabajo'],
  carpintero:         ['dashboard','produccion','ordenes','proyectos','materiales','horas_trabajo'],
  ayudante:           ['dashboard','produccion','horas_trabajo'],
};

// --- Helpers ---

/** Devuelve el array de module keys permitidos para un rol dado. */
export function modulosPermitidos(rol) {
  if (rol === 'admin') return MODULOS.map(m => m.key);
  return PERMISOS_POR_ROL[rol] || [];
}

/** Este rol puede acceder al modulo indicado por su key? */
export function tieneAcceso(rol, moduloKey) {
  if (rol === 'admin') return true;
  return modulosPermitidos(rol).includes(moduloKey);
}

/** Busca el modulo cuyo path coincide con un pathname de router (match por prefijo, el mas especifico primero). */
export function moduloPorPath(pathname) {
  const candidatos = MODULOS
    .filter(m => m.path === '/' ? pathname === '/' : pathname.startsWith(m.path))
    .sort((a, b) => b.path.length - a.path.length);
  return candidatos[0] || null;
}

/** Este rol puede acceder a esta URL (pathname) del router? */
export function puedeAccederRuta(rol, pathname) {
  const modulo = moduloPorPath(pathname);
  if (!modulo) return true; // rutas no catalogadas (ej. detalle /prospectos/:id ya matchea por prefijo /prospectos)
  return tieneAcceso(rol, modulo.key);
}

/** Primera ruta a la que este rol si tiene acceso -- util para redirigir tras un intento invalido. */
export function primeraRutaPermitida(rol) {
  if (rol === 'admin') return '/';
  const permitidos = modulosPermitidos(rol);
  if (permitidos.includes('dashboard')) return '/';
  const primero = MODULOS.find(m => permitidos.includes(m.key));
  return primero ? primero.path : '/login';
}
