/**
 * formulariosService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * DE DÓNDE SALEN LOS FORMULARIOS QUE ALIMENTAN AL PLAN.
 *
 * Hasta ahora: solo los GUARDADOS. Mientras el operador no cierra el registro,
 * lo que ya cargó no existe para nadie — y en planta el cierre suele ser al
 * final del turno, así que el plan y los indicadores iban siempre atrás de la
 * realidad.
 *
 * Ahora se pueden sumar los BORRADORES, marcados como provisionales
 * (`_borrador: true`). Son los mismos datos, en la misma forma; lo único que
 * cambia es que todavía nadie los firmó.
 *
 * Sin doble conteo: FillForm borra el borrador después de guardar el
 * formulario, así que un registro está en un lado o en el otro, nunca en los
 * dos. Si el borrado llegara a fallar, el formulario guardado y su borrador
 * tendrían el mismo contenido y sí se contarían dos veces — por eso el número
 * de provisionales se muestra siempre a la vista, para que se note.
 */

import { API_BASE_URL } from '../apiConfig';

const lista = (x) => (Array.isArray(x) ? x : (x?.$values ?? []));

/** ¿Este registro todavía no fue cerrado por el operador? */
export const esBorrador = (f) => f?._borrador === true || f?.esBorrador === true;

/**
 * Formularios para calcular: los guardados y, si se piden, los borradores.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.incluirBorradores=false]
 * @param {number}  [opts.dias=30]  ventana de borradores a traer
 * @returns {Promise<{formularios: Array, guardados: number, borradores: number}>}
 */
export async function cargarFormularios({ incluirBorradores = false, dias = 30 } = {}) {
  const pedidos = [fetch(`${API_BASE_URL}/FilledForms`)];

  if (incluirBorradores) {
    // Si el backend todavía no tiene el endpoint, se sigue con los guardados:
    // los indicadores nunca se quedan en blanco por esto.
    pedidos.push(
      fetch(`${API_BASE_URL}/FormDrafts/con-datos?dias=${dias}`)
        .then(r => (r.ok ? r.json() : []))
        .catch(() => [])
    );
  }

  const [resForms, crudoDrafts] = await Promise.all(pedidos);
  if (!resForms.ok) throw new Error(`HTTP ${resForms.status}`);

  const guardados = lista(await resForms.json());
  const borradores = lista(crudoDrafts).map(d => ({ ...d, _borrador: true }));

  return {
    formularios: [...guardados, ...borradores],
    guardados: guardados.length,
    borradores: borradores.length,
  };
}
