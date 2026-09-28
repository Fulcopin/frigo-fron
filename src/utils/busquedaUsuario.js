/**
 * busquedaUsuario.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 👤 Búsqueda de personas en una celda del formulario.
 *
 * Se configura por columna (o campo) en Crear/Editar Plantilla, igual que la
 * búsqueda de productos. Al llenar, la celda ofrece los nombres para elegir en
 * vez de escribirlos a mano, que es de donde salen los "Karina P." y las
 * variantes que después no cruzan con nada.
 *
 * De dónde salen los nombres:
 *   usuarios  → usuarios del sistema (API de nombres)
 *   catalogo  → catálogo de firmas (quienes firman los registros)
 *   ambos     → las dos listas, sin repetidos
 */

export const BUSQUEDA_USUARIO_OPCIONES = [
  { value: '', label: '— Sin búsqueda de personas —' },
  { value: 'usuarios', label: '👥 Usuarios del sistema' },
  { value: 'catalogo', label: '✍️ Catálogo de firmas' },
  { value: 'ambos', label: '🔎 Usuarios y catálogo' },
];

export const usaBusquedaUsuario = (campo) =>
  !!campo && ['usuarios', 'catalogo', 'ambos'].includes(String(campo.busquedaUsuario || ''));

/** Texto comparable: sin tildes, minúsculas y con espacios simples. */
export const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Filtra la lista por lo que se va escribiendo (por nombre, puesto o usuario). */
export function filtrarPersonas(personas, texto, maximo = 25) {
  const q = normalizar(texto);
  const lista = personas || [];
  if (!q) return lista.slice(0, maximo);

  const empiezan = [];
  const contienen = [];
  for (const p of lista) {
    const campos = normalizar(`${p.nombre} ${p.puesto || ''} ${p.usuario || ''}`);
    if (campos.startsWith(q)) empiezan.push(p);
    else if (campos.includes(q)) contienen.push(p);
    if (empiezan.length >= maximo) break;
  }
  return [...empiezan, ...contienen].slice(0, maximo);
}
