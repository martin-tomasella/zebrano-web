
// ============================================================
// ZEBRANO ERP â Sistema central de Roles y Permisos
// Ãnica fuente de verdad para: sidebar (Layout), protecciÃ³n de
// rutas (App.js) y la matriz visual en /usuarios.
// ============================================================

// âââ CatÃ¡logo de roles ââââââââââââââââââââââââââââââââââââââ
// key: valor guardado en empleados.rol (texto libre en DB)
export const ROLES = {
  admin: {
    label: 'Administrador',
    descripcion: 'Acceso total. Puede ver, crear, editar y eliminar en todos los mÃ³dulos, incluyendo la gestiÃ³n de usuarios y sus roles.',
    color: '#8F2FFE',
  },
  gestion: {
    label: 'GestiÃ³n',
    descripcion: 'Acceso total al negocio (ventas, producciÃ³n, insumos, finanzas y usuarios) excepto el mÃ³dulo de Marketing / Redes Sociales.',
    color: '#60a5fa',
  },
  carpintero_oficial: {
    label: 'Carpintero Oficial',
    descripcion: 'Rol de taller. Pensado para acceso operativo a ProducciÃ³n, Proyectos, Materiales y registro de Horas de trabajo.',
    color: '#4ade80',
  },
  carpintero: {
    label: 'Carpintero',
    descripcion: 'Rol de taller. Pensado para acceso operativo a ProducciÃ³n, Proyectos, Materiales y registro de Horas de trabajo.',
    color: '#4ade80',
  },
  ayudante: {
    label: 'Ayudante',
    descripcion: 'Rol de taller con acceso mÃ¡s acotado: ProducciÃ³n y registro de Horas de trabajo.',
    color: '#fbbf24',
  },
};

export const ROLES_SELECCIONABLES = Object.keys(ROLES);

// âââ CatÃ¡logo de mÃ³dulos ââââââââââââââââââââââââââââââââââââ
// Cada mÃ³dulo declara su ruta base y a quÃ© categorÃ­a pertenece.
// `match` define cÃ³mo se compara contra location.pathname.
export const MODULOS = [
  { key:'dashboard',    label:'Dashboard',           path:'/',              categoria:'Principal' },

  { key:'prospectos',   label:'Prospectos',          path:'/prospectos',    categoria:'Ventas' },
  { key:'clientes',     label:'Clientes',            path:'/clientes',      categoria:'Ventas' },
  { key:'cotizador',    label:'Cotizador AI',        path:'/cotizador',     categoria:'Ventas' },
  { key:'proyectos',    label:'Proyectos',           path:'/proyectos',     categoria:'Ventas' },
  { key:'metricas',     label:'Tiempos de ciclo',    path:'/metricas',      categoria:'Ventas' },

  { key:'produccion',      label:'ProducciÃ³n',        path:'/produccion',      categoria:'ProducciÃ³n' },
  { key:'horas_trabajo',   label:'Horas de trabajo',  path:'/horas-trabajo',   categoria:'ProducciÃ³n' },

  { key:'proveedores',  label:'Proveedores',         path:'/proveedores',   categoria:'Insumos' },
  { key:'materiales',   label:'Materiales',          path:'/materiales',    categoria:'Insumos' },

  { key:'finanzas',     label:'Finanzas',             path:'/finanzas',      categoria:'AdministraciÃ³n' },
  { key:'usuarios',     label:'Usuarios',             path:'/usuarios',      categoria:'AdministraciÃ³n' },
  { key:'landing',      label:'Landing pÃºblica',      path:'/landing',       categoria:'AdministraciÃ³n' },

  { key:'tiktok',           label:'TikTok',            path:'/tiktok',           categoria:'Marketing' },
  { key:'rrss',              label:'Instagram / FB',    path:'/rrss',             categoria:'Marketing' },
  { key:'rrss_importar',    label:'Importar fotos',    path:'/rrss/importar',   categoria:'Marketing' },
];

export const CATEGORIAS_ORDEN = ['Principal','Ventas','ProducciÃ³n','Insumos','AdministraciÃ³n','Marketing'];

// âââ Matriz de permisos: rol â set de module keys permitidos â
// admin: acceso implÃ­cito a todo (se resuelve aparte, no listamos todo acÃ¡)
const PERMISOS_POR_ROL = {
  // gestion: todo excepto Marketing y Administracion (por ahora)
  gestion: MODULOS.filter(m => m.categoria !== 'Marketing' && m.categoria !== 'Administración').map(m => m.key),

  // Roles de taller: acceso operativo acotado
  carpintero_oficial: ['dashboard','produccion','proyectos','materiales','horas_trabajo'],
  carpintero:         ['dashboard','produccion','proyectos','materiales','horas_trabajo'],
  ayudante:           ['dashboard','produccion','horas_trabajo'],
};

// âââ Helpers âââââââââââââââââââââââââââââââââââââââââââââââââ

/** Devuelve el array de module keys permitidos para un rol dado. */
export function modulosPermitidos(rol) {
  if (rol === 'admin') return MODULOS.map(m => m.key);
  return PERMISOS_POR_ROL[rol] || [];
}

/** Â¿Este rol puede acceder al mÃ³dulo indicado por su key? */
export function tieneAcceso(rol, moduloKey) {
  if (rol === 'admin') return true;
  return modulosPermitidos(rol).includes(moduloKey);
}

/** Busca el mÃ³dulo cuyo path coincide con un pathname de router (match por prefijo, el mÃ¡s especÃ­fico primero). */
export function moduloPorPath(pathname) {
  const candidatos = MODULOS
    .filter(m => m.path === '/' ? pathname === '/' : pathname.startsWith(m.path))
    .sort((a, b) => b.path.length - a.path.length);
  return candidatos[0] || null;
}

/** Â¿Este rol puede acceder a esta URL (pathname) del router? */
export function puedeAccederRuta(rol, pathname) {
  const modulo = moduloPorPath(pathname);
  if (!modulo) return true; // rutas no catalogadas (ej. detalle /prospectos/:id ya matchea por prefijo /prospectos)
  return tieneAcceso(rol, modulo.key);
}

/** Primera ruta a la que este rol sÃ­ tiene acceso â Ãºtil para redirigir tras un intento invÃ¡lido. */
export function primeraRutaPermitida(rol) {
  if (rol === 'admin') return '/';
  const permitidos = modulosPermitidos(rol);
  if (permitidos.includes('dashboard')) return '/';
  const primero = MODULOS.find(m => permitidos.includes(m.key));
  return primero ? primero.path : '/login';
}
