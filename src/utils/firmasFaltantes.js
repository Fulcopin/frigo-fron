/**
 * firmasFaltantes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ✍️ Quién falta firmar en un formulario.
 *
 * Cruza los puestos definidos en la plantilla (templateFirmas) contra las
 * firmas ya puestas (firmasData). Sirve para que en "Pendientes de firma" se
 * vea DE UNA quién falta, sin tener que abrir el formulario.
 *
 * Un puesto cuenta como firmado cuando tiene imagen de firma (url o base64),
 * la misma regla que usa el aviso por correo.
 */

const comoObjeto = (valor) => {
  if (!valor) return null;
  if (typeof valor === 'object') return valor;
  try { return JSON.parse(valor); } catch { return null; }
};

const comoLista = (valor) => {
  const v = comoObjeto(valor);
  if (Array.isArray(v)) return v;
  if (Array.isArray(v?.$values)) return v.$values;
  return [];
};

const norm = (t) => String(t ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

/** ¿Ese puesto ya tiene una firma con imagen? */
export function puestoFirmado(firmasData, puesto) {
  const firmas = comoObjeto(firmasData);
  if (!firmas || typeof firmas !== 'object') return false;

  const clave = Object.keys(firmas).find((k) => norm(k) === norm(puesto));
  const dato = clave ? firmas[clave] : null;
  if (!dato || typeof dato !== 'object') return false;

  const firma = dato.firma;
  if (!firma || typeof firma !== 'object') return false;
  return !!(firma.url || firma.base64);
}

/** Quién firmó ese puesto (nombre guardado), o ''. */
export function quienFirmo(firmasData, puesto) {
  const firmas = comoObjeto(firmasData);
  if (!firmas || typeof firmas !== 'object') return '';
  const clave = Object.keys(firmas).find((k) => norm(k) === norm(puesto));
  return clave ? String(firmas[clave]?.nombre || '').trim() : '';
}

/**
 * Lista de lo que falta firmar.
 * @returns {Array<{puesto, nombre, reemplazos: string[]}>}
 */
export function firmasFaltantes(form) {
  const puestos = comoLista(form?.templateFirmas);
  if (puestos.length === 0) return [];

  return puestos
    .map((f) => ({
      puesto: String(f?.puesto || '').trim(),
      nombre: String(f?.nombreCompleto || '').trim(),
      reemplazos: comoLista(f?.reemplazos).map((r) => String(r || '').trim()).filter(Boolean),
    }))
    .filter((f) => f.puesto && !puestoFirmado(form?.firmasData, f.puesto));
}

/** Resumen corto: "2 de 3 firmas · falta Gerente de Producción (JOSE MONTESDEOCA)". */
export function resumenFirmas(form) {
  const puestos = comoLista(form?.templateFirmas).filter((f) => String(f?.puesto || '').trim());
  const faltan = firmasFaltantes(form);
  const total = puestos.length;
  const hechas = total - faltan.length;

  return {
    total,
    hechas,
    faltan,
    completo: total > 0 && faltan.length === 0,
    texto: total === 0
      ? 'Sin firmas definidas'
      : faltan.length === 0
        ? `✅ Firmado por todos (${total})`
        : `${hechas} de ${total} firmas · falta ${faltan.map(f => f.nombre || f.puesto).join(', ')}`,
  };
}