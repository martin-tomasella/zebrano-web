// Áreas de la oficina virtual y colores de estado (compartido entre la página y la escena 3D, sin cargar three.js).
export const AREAS = {
  comercial:   { label: 'COMERCIAL · VENTAS', x: -10, z: -6 },
  diseno:      { label: 'DISEÑO Y COTIZACIÓN', x: 2, z: -6 },
  contenidos:  { label: 'CONTENIDOS Y REDES', x: 12, z: -6 },
  operaciones: { label: 'OPERACIONES · COMPRAS · TALLER', x: -10, z: 2.5 },
  mercado:     { label: 'MERCADO', x: 12, z: 2.5 },
  direccion:   { label: 'DIRECCIÓN', x: 2, z: 1 },
  descanso:    { label: 'DESCANSO', x: -12, z: 9.5 },
}
export const COLOR_ESTADO = { trabajando: '#2fbf71', esperando: '#f2b01e', trabado: '#e5484d', libre: '#9aa0a6' }
