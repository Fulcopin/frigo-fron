/**
 * codigosEnUsoService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ¿ESTE CÓDIGO DE MATERIA PRIMA YA ESTÁ EN OTRO FORMULARIO?
 *
 * El bloqueo que había en el navegador solo miraba (a) el formulario abierto y
 * (b) el «usado» de la API externa en el instante en que se tipea el código.
 * Los BORRADORES no marcan nada en esa API: mientras dos formularios están sin
 * guardar, la API dice que el código está libre para los dos. Así entró el
 * código A26235-002-066 en el PD-04 de Blue Marlin (form 1775) y en el de
 * Swordfish (form 1776) el 24/08, sin que saltara ningún aviso.
 *
 * Este servicio pregunta a NUESTRA base, que sí ve los borradores.
 *
 * Regla importante: si el endpoint no está (backend viejo) o el servidor no
 * contesta, NO se bloquea nada. Una verificación caída no puede dejar a planta
 * sin poder guardar; simplemente se avisa que no se pudo verificar.
 */

import { API_BASE_URL } from '../apiConfig';

const lista = (x) => (Array.isArray(x) ? x : (x?.$values ?? []));

/**
 * Busca los códigos en formularios guardados y en borradores.
 *
 * @param {object} p
 * @param {string[]} p.codigos        códigos a verificar
 * @param {number}  [p.templateId]    acota al mismo tipo de formulario
 * @param {number}  [p.excluirFormId] el formulario que se está editando
 * @param {number}  [p.excluirDraftId] el borrador propio de esta pantalla
 * @param {number}  [p.dias=60]       ventana de búsqueda
 * @returns {Promise<{
 *   verificado: boolean,
 *   usados: Array<{codigo, origen: 'formulario'|'borrador', id, especie, lote, usuario, fecha}>,
 *   enFormularios: Array, enBorradores: Array,
 * }>}
 */
export async function buscarCodigosEnUso({
  codigos, templateId, excluirFormId, excluirDraftId, dias = 60,
}) {
  const limpios = [...new Set((codigos || [])
    .map(c => String(c ?? '').trim())
    .filter(Boolean))];

  if (limpios.length === 0) {
    return { verificado: true, usados: [], enFormularios: [], enBorradores: [] };
  }

  const params = new URLSearchParams({ codigos: limpios.join(','), dias: String(dias) });
  if (templateId) params.set('templateId', String(templateId));
  if (excluirFormId) params.set('excluirFormId', String(excluirFormId));
  if (excluirDraftId) params.set('excluirDraftId', String(excluirDraftId));

  try {
    const res = await fetch(`${API_BASE_URL}/FilledForms/codigos-en-uso?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const usados = lista(data.usados);
    return {
      verificado: true,
      usados,
      enFormularios: usados.filter(u => u.origen === 'formulario'),
      enBorradores: usados.filter(u => u.origen === 'borrador'),
    };
  } catch (e) {
    // Backend sin el endpoint todavía, o sin red: no se bloquea a nadie.
    console.warn('No se pudo verificar códigos en uso:', e.message);
    return { verificado: false, usados: [], enFormularios: [], enBorradores: [] };
  }
}

/** Texto para el aviso: dónde está usado cada código. */
export function detalleDeUso(usados) {
  return usados
    .map(u => {
      const donde = u.origen === 'borrador' ? 'BORRADOR' : 'formulario';
      const quien = u.usuario ? ` · ${u.usuario}` : '';
      const esp = u.especie ? ` · ${u.especie}` : '';
      const lote = u.lote ? ` · lote ${u.lote}` : '';
      const cuando = u.fecha ? ` · ${String(u.fecha).slice(0, 10)}` : '';
      return `• ${u.codigo} → ${donde} #${u.id}${esp}${lote}${quien}${cuando}`;
    })
    .join('\n');
}
