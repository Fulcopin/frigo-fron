/**
 * especiesLote.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ¿DE QUÉ ESPECIE ES ESTE CÓDIGO?
 *
 * Los reportes de proceso (PD-04 y compañía) son de UNA sola especie: se
 * declara arriba, en el campo «Especie» del encabezado, y todas las filas de
 * materia prima tienen que ser de esa. Tallas y presentaciones se mezclan;
 * especies no.
 *
 * Igual se coló: en el PD-04 del 24/08 (formulario 1776, «Swordfish») entró
 * el código A26235-002-066, que es «MP Blue Marlin Filete Fres.». Nada lo
 * detectó. Este módulo es esa segunda mirada: compara la especie declarada
 * arriba con la que dice la clasificación de cada fila.
 *
 * Regla de oro para no molestar al operario: solo se avisa cuando las DOS
 * especies se reconocen y son distintas. Si alguna no se reconoce («80-100»,
 * un producto nuevo, un texto raro), no se opina. Así «Sword fish» vs
 * «Swordfish Filete MP Fres.» no genera un falso aviso, que es lo que
 * arruinaría la validación: al tercer aviso equivocado nadie la lee.
 */

/**
 * Alias de cada especie, como aparecen escritos de verdad en los formularios
 * (relevados de los 156 PD-04 guardados: «Sword fish», «Swordfis», «Blue
 * marlin», «Mahi Mahi», «Tuna YF SEG»…). Agregar una especie nueva es
 * agregar una línea acá.
 */
export const ESPECIES = [
  { id: 'SWORDFISH',  label: 'Swordfish',   alias: ['swordfish', 'swordfis', 'sword', 'espada', 'pezespada', 'swd'] },
  { id: 'BLUEMARLIN', label: 'Blue Marlin', alias: ['bluemarlin', 'marlin', 'picudo'] },
  { id: 'MAHI',       label: 'Mahi Mahi',   alias: ['mahimahi', 'mahi', 'dorado'] },
  { id: 'TUNA',       label: 'Tuna',        alias: ['tuna', 'atun', 'yellowfin', 'bigeye'] },
  { id: 'WAHOO',      label: 'Wahoo',       alias: ['wahoo'] },
  { id: 'CAMARON',    label: 'Camarón',     alias: ['camaron', 'shrimp'] },
];

/**
 * Deja el texto comparable: sin tildes, sin mayúsculas y SIN separadores.
 * Es lo que hace que «Sword fish», «SWORD-FISH» y «Swordfish» sean lo mismo.
 */
const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

/**
 * La especie que menciona un texto, sea el encabezado («Sword fish entero») o
 * la clasificación de una fila («MP Blue Marlin Filete Fres.»).
 * @returns {{id: string, label: string} | null} null = no se reconoce ninguna.
 */
export function especieDeTexto(texto) {
  const t = norm(texto);
  if (!t) return null;
  for (const esp of ESPECIES) {
    if (esp.alias.some(a => t.includes(a))) return { id: esp.id, label: esp.label };
  }
  return null;
}

/**
 * ¿Estos dos textos hablan de la misma especie?
 * true también cuando alguno no se reconoce: sin certeza no se molesta.
 */
export function mismaEspecie(a, b) {
  const ea = especieDeTexto(a);
  const eb = especieDeTexto(b);
  if (!ea || !eb) return true;
  return ea.id === eb.id;
}

/**
 * Revisa las filas de materia prima contra la especie del encabezado.
 *
 * @param {string} especieDeclarada  lo que dice el encabezado («Swordfish»)
 * @param {Array<{codigo: string, texto: string, fila?: number}>} filas
 * @returns {{
 *   especie: {id, label} | null,
 *   intrusas: Array<{codigo, texto, fila, especie: {id, label}}>,
 *   resumen: string
 * }}
 */
export function revisarEspecies(especieDeclarada, filas) {
  const especie = especieDeTexto(especieDeclarada);
  const intrusas = [];

  // Sin especie declarada (o irreconocible) no hay contra qué comparar.
  if (especie) {
    for (const f of (filas || [])) {
      const e = especieDeTexto(f.texto);
      if (e && e.id !== especie.id) intrusas.push({ ...f, especie: e });
    }
  }

  // Se agrupa por especie intrusa: «2 de Tuna» se lee mejor que dos líneas.
  const porEspecie = new Map();
  for (const i of intrusas) {
    porEspecie.set(i.especie.label, (porEspecie.get(i.especie.label) || 0) + 1);
  }
  const resumen = [...porEspecie.entries()]
    .map(([label, n]) => `${n} de ${label}`)
    .join(', ');

  return { especie, intrusas, resumen };
}
