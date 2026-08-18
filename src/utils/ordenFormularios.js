/**
 * ordenFormularios.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ORDEN ÚNICO DE LOS FORMULARIOS en todos los filtros y listados.
 *
 * Los formularios se buscan por su NÚMERO (FOR-PD-04, FOR-CC-15…), no por su
 * nombre. Antes cada pantalla los mostraba en el orden en que los devolvía la
 * API — es decir, por orden de creación — y encontrar uno era una lotería.
 *
 * Regla:
 *   1. Se agrupan por familia (CA, CC, PD…) en orden alfabético.
 *   2. Dentro de cada familia, por número ASCENDENTE de verdad: PD-04 antes que
 *      PD-14 (comparación numérica, no de texto: "10" no va antes que "9").
 *   3. Los que no tienen número van al final, ordenados por nombre.
 */

const limpiar = (s) => String(s ?? '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .trim().toUpperCase();

/**
 * Parte un código de formulario en sus piezas comparables.
 * "FOR-PD-04" → { familia: 'PD', numero: 4, resto: '' }
 * "FOR-CC-15" → { familia: 'CC', numero: 15 }
 * "FOR-CA-1"  → { familia: 'CA', numero: 1 }
 */
export function partesCodigo(codigo) {
  const c = limpiar(codigo).replace(/^FOR[-\s]*/, '');
  const m = c.match(/^([A-Z]+)[-\s]*(\d+)(.*)$/);
  if (m) return { familia: m[1], numero: Number(m[2]), resto: m[3].trim(), crudo: c };
  return { familia: c, numero: Number.POSITIVE_INFINITY, resto: '', crudo: c };
}

/**
 * Compara dos códigos de formulario. Sirve directo como callback de .sort().
 * Los formularios sin código quedan al final.
 */
export function compararCodigos(a, b) {
  const ca = limpiar(a);
  const cb = limpiar(b);
  if (!ca && !cb) return 0;
  if (!ca) return 1;   // sin número → al final
  if (!cb) return -1;

  const pa = partesCodigo(ca);
  const pb = partesCodigo(cb);
  if (pa.familia !== pb.familia) return pa.familia.localeCompare(pb.familia, 'es');
  if (pa.numero !== pb.numero) return pa.numero - pb.numero;
  return pa.crudo.localeCompare(pb.crudo, 'es', { numeric: true });
}

/**
 * Ordena una lista de formularios por su número. No modifica la lista original.
 *
 * @param {Array}    lista
 * @param {Function} [getCodigo] — cómo sacar el código de cada elemento
 * @param {Function} [getNombre] — desempate cuando no hay código
 * @returns {Array} una copia ordenada
 */
export function ordenarFormularios(lista, getCodigo = codigoDe, getNombre = nombreDe) {
  return [...(lista || [])].sort((a, b) => {
    const porCodigo = compararCodigos(getCodigo(a), getCodigo(b));
    if (porCodigo !== 0) return porCodigo;
    return String(getNombre(a) || '').localeCompare(String(getNombre(b) || ''), 'es', { numeric: true });
  });
}

/** Código de un formulario, venga como venga de la API. */
export const codigoDe = (t) =>
  t?.codigo ?? t?.Codigo ?? t?.code ?? t?.templateCodigo ?? t?.formCode ?? '';

/** Nombre de un formulario, venga como venga de la API. */
export const nombreDe = (t) =>
  t?.nombre ?? t?.Nombre ?? t?.name ?? t?.templateNombre ?? t?.formName ?? '';

/**
 * Etiqueta para mostrar en un desplegable: siempre empieza por el número, que
 * es por donde la gente busca.
 * @returns {string} "FOR-PD-04 — CONTROL DE PRODUCCIÓN…"
 */
export function etiquetaFormulario(t) {
  const codigo = String(codigoDe(t) || '').trim();
  const nombre = String(nombreDe(t) || '').trim();
  if (codigo && codigo !== 'N/A' && nombre) return `${codigo} — ${nombre}`;
  return codigo && codigo !== 'N/A' ? codigo : (nombre || 'Sin nombre');
}

export default { ordenarFormularios, compararCodigos, etiquetaFormulario, codigoDe, nombreDe, partesCodigo };
