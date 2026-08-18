/**
 * fechaFormulario.js
 * ─────────────────────────────────────────────────────────────────────────────
 * LA FECHA QUE VALE DE UN REGISTRO ES LA QUE ESCRIBIÓ EL OPERARIO, no la de
 * cuando se guardó.
 *
 * Un registro del día 30 se guarda al otro día y en la lista aparecía como "31":
 * buscar "del 30 al 30" no lo encontraba, y buscar "del 31" tampoco traía los
 * que por dentro decían 31. Por eso las búsquedas usan la fecha del ENCABEZADO
 * y solo caen a la de guardado cuando el formulario no tiene campo de fecha.
 */

const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .trim().toUpperCase();

/**
 * Campos que dicen "fecha" pero NO son la fecha del registro: vencimientos,
 * caducidad, la fecha de versión de la plantilla, etc.
 */
const NO_ES_LA_FECHA = /VENCIM|CADUC|EXPIR|VERSION|ELABORAC.*ETIQUET|NACIM/;

/** Devuelve 'YYYY-MM-DD' a partir de los formatos que se guardan en la app. */
export function aFechaISO(valor) {
  const v = String(valor ?? '').trim();
  if (!v) return '';

  // 2026-07-30 / 2026-07-30T09:05:01 / 2026-07-30 09:05
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // 30/07/2026 · 30-07-2026 · 3/7/2026
  const dmy = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) {
    const d = dmy[1].padStart(2, '0');
    const m = dmy[2].padStart(2, '0');
    return `${dmy[3]}-${m}-${d}`;
  }

  // Último recurso: que lo interprete el navegador (ej. "Jul 30 2026")
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return '';
}

/**
 * La fecha escrita DENTRO del formulario (campo del encabezado).
 *
 * Gana el campo que se llame exactamente "FECHA"; si no hay, el primero que
 * mencione fecha y traiga algo que parezca una fecha.
 *
 * @param {Object} form — registro con headerData
 * @returns {string} 'YYYY-MM-DD' o '' si el formulario no tiene fecha propia
 */
export function fechaInternaDeFormulario(form) {
  const header = form?.headerData;
  if (!header || typeof header !== 'object') return '';

  const candidatos = [];
  for (const [clave, valor] of Object.entries(header)) {
    const k = norm(clave);
    if (!k.includes('FECHA') && !k.startsWith('DIA')) continue;
    if (NO_ES_LA_FECHA.test(k)) continue;
    const iso = aFechaISO(valor);
    if (!iso) continue;
    // "FECHA" a secas es la del registro; el resto queda como respaldo.
    candidatos.push({ iso, exacta: k === 'FECHA' || k === 'FECHA:' });
  }
  if (candidatos.length === 0) return '';
  return (candidatos.find(c => c.exacta) || candidatos[0]).iso;
}

/**
 * La fecha con la que se busca y se muestra un registro: la de adentro si la
 * tiene, y si no la de guardado.
 * @returns {string} 'YYYY-MM-DD'
 */
export function fechaDeBusqueda(form) {
  return fechaInternaDeFormulario(form) || aFechaISO(form?.createdAt);
}

/** ¿La fecha del registro cae dentro del rango elegido? Rango inclusivo. */
export function entraEnRango(form, desde, hasta) {
  if (!desde && !hasta) return true;
  const fecha = fechaDeBusqueda(form);
  if (!fecha) return false;
  if (desde && fecha < desde) return false;
  if (hasta && fecha > hasta) return false;
  return true;
}

/** ¿La fecha de adentro y la de guardado son de días distintos? */
export function fechaDifiereDeGuardado(form) {
  const interna = fechaInternaDeFormulario(form);
  if (!interna) return false;
  return interna !== aFechaISO(form?.createdAt);
}

export default { aFechaISO, fechaInternaDeFormulario, fechaDeBusqueda, entraEnRango, fechaDifiereDeGuardado };
