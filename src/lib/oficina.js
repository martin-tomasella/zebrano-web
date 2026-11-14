// Áreas de la oficina virtual, etapas del tablero y colores de estado (compartido entre la página y la escena 3D, sin cargar three.js).
// Rediseño 14/11/2026: planta compacta y ancha (≈34 × 15 m) para que el plano general llene pantallas anchas.
export const AREAS = {
  comercial:   { label: 'COMERCIAL', x: -9, z: -3.6, alfombra: '#e9d6c0' },
  diseno:      { label: 'DISEÑO Y COTIZACIÓN', x: 0.5, z: -3.6, alfombra: '#dcd3c9' },
  contenidos:  { label: 'CONTENIDOS Y REDES', x: 8, z: -3.6, alfombra: '#efd3df' },
  operaciones: { label: 'COMPRAS Y TALLER', x: -9, z: 3.6, alfombra: '#e6dcc6' },
  direccion:   { label: 'DIRECCIÓN', x: 0.5, z: 3.6, alfombra: '#ece2bf' },
  mercado:     { label: 'MERCADO', x: 8, z: 3.6, alfombra: '#ecd2cf' },
  descanso:    { label: 'DESCANSO', x: 15.5, z: 0, alfombra: '#cfdccf' },
}
export const COLOR_ESTADO = { trabajando: '#2fbf71', esperando: '#f2b01e', trabado: '#e5484d', libre: '#9aa0a6' }
// Tablero "del contacto al taller": qué agentes trabajan en cada etapa.
export const ETAPAS = [
  { k: 'buscar', nombre: 'Buscar', agentes: ['algarrobo', 'quebracho'] },
  { k: 'atender', nombre: 'Atender', agentes: ['roble'] },
  { k: 'cotizar', nombre: 'Cotizar', agentes: ['nogal'] },
  { k: 'cerrar', nombre: 'Cerrar', agentes: ['cedro'] },
  { k: 'producir', nombre: 'Producir', agentes: ['guatambu'] },
  { k: 'difundir', nombre: 'Difundir', agentes: ['lapacho'] },
]
