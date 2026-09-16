// ====================================
// COLUMNAS DEL DASHBOARD DE PERSONAL
// ====================================
// Una sola definición sirve para la tabla en pantalla y para el Excel: si
// mañana se agrega una columna aquí, aparece en los dos lados sin tocar
// ni la página ni el servicio de exportación.

// v2: cambió el orden de columnas y se ocultó el nombre largo. Subir la
// versión descarta las preferencias guardadas con el orden viejo — si no,
// quien ya había abierto la pantalla seguiría viendo el layout anterior y no
// entendería por qué a los demás sí les cambió.
export const STORAGE_COLUMNAS = 'frigolab.personal.columnas.v2';

export const COLUMNAS_PERSONAL = [
  // Orden pensado para el reporte: primero lo que identifica el registro y
  // permite ir a buscarlo, después el proceso y los números.
  //
  // El nombre largo del formulario queda OCULTO por defecto: ocupaba media
  // pantalla repitiendo "CONTROL DE PRODUCTIVIDAD - PERSONAL" y el código dice
  // lo mismo en cuatro caracteres. Sigue disponible en el selector de columnas
  // para quien lo necesite.
  { id: 'codigo', label: 'Código', ancho: 14, tipo: 'texto' },
  { id: 'formID', label: 'N° Registro', ancho: 12, tipo: 'entero' },
  { id: 'destino', label: 'Destino', ancho: 20, tipo: 'texto' },
  // El lote identifica el flujo: los pasos del mismo lote van encadenados.
  { id: 'lote', label: 'Lote', ancho: 14, tipo: 'texto' },
  { id: 'especie', label: 'Especie', ancho: 16, tipo: 'texto' },
  { id: 'pesoProduccion', label: 'Peso producción (Lbs)', ancho: 18, tipo: 'decimal' },
  { id: 'proceso', label: 'Proceso', ancho: 24, tipo: 'texto' },
  { id: 'fecha', label: 'Fecha', ancho: 12, tipo: 'fecha' },
  { id: 'planta', label: 'Planta', ancho: 10, tipo: 'entero' },
  { id: 'externo', label: 'Externo', ancho: 10, tipo: 'entero' },
  { id: 'horaInicio', label: 'Hora inicio', ancho: 12, tipo: 'texto' },
  { id: 'horaFin', label: 'Hora fin', ancho: 12, tipo: 'texto' },
  { id: 'horas', label: 'Horas', ancho: 10, tipo: 'decimal' },
  // Marcas de Inicio y Cierre del flujo, puestas por el operario.
  { id: 'flujo', label: 'Entrada / Salida', ancho: 15, tipo: 'texto' },
  // Suma de todas las franjas del formulario, repetida en cada fila para que
  // ninguna quede vacía.
  //
  // ⚠️ NO se puede sumar: daría el total multiplicado por la cantidad de filas.
  // Para totalizar está la columna de al lado.
  { id: 'horasTotales', label: 'Total horas', ancho: 12, tipo: 'decimal' },
  // El mismo total pero UNA sola vez por formulario. Esta sí se suma.
  { id: 'horasTotalesUnicas', label: 'Total horas (sumable)', ancho: 18, tipo: 'decimal', ocultaPorDefecto: true },
  // Total producido del formulario, repetido en cada fila para que se vea.
  // ⚠️ NO sumar: para totalizar está la de al lado.
  { id: 'pesoTotal', label: 'Total producido (Lbs)', ancho: 18, tipo: 'decimal' },
  { id: 'pesoTotalUnico', label: 'Total producido (sumable)', ancho: 20, tipo: 'decimal', ocultaPorDefecto: true },
  { id: 'observacion', label: 'Observación', ancho: 55, tipo: 'texto' },
  { id: 'formulario', label: 'Nombre del formulario', ancho: 38, tipo: 'texto', ocultaPorDefecto: true },
];

export const definicionColumna = (id) => COLUMNAS_PERSONAL.find(c => c.id === id);

// TimeSpan del backend llega como "HH:MM:SS"; en pantalla y en Excel basta HH:MM.
const soloHora = (ts) => (ts ? String(ts).substring(0, 5) : '');

/**
 * Valor crudo para Excel: los números salen como números y la fecha como Date,
 * para que las sumas, los filtros y las tablas dinámicas de Excel funcionen.
 * Si sale todo como texto, la hoja no sirve para nada más que mirarla.
 */
/**
 * Valor crudo para EXCEL.
 *
 * Acá los vacíos van vacíos de verdad, NO con guion: un "—" en una columna de
 * Excel rompe los filtros y las tablas dinámicas, porque pasa a ser un valor
 * de texto más. En pantalla sí se muestra el guion, que es donde ayuda a leer.
 */
export function valorCrudo(r, id) {
  switch (id) {
    case 'codigo': return r.codigo ?? '';
    case 'formID': return r.formID ?? null;
    case 'formulario': return r.formulario ?? '';
    case 'destino': return r.destino ?? '';
    case 'lote': return r.lote ?? '';
    case 'especie': return r.especie ?? '';
    case 'pesoTotal': return r.pesoTotalFormulario != null ? Number(r.pesoTotalFormulario) : null;
    case 'pesoTotalUnico': return r.pesoTotalUnico != null ? Number(r.pesoTotalUnico) : null;
    case 'flujo': {
      // Texto plano para poder filtrar el Excel por "Entrada" o "Salida".
      const m = [];
      if (r.esInicio) m.push('Entrada');
      if (r.esCierre) m.push('Salida');
      return m.join(' + ');
    }
    case 'horasTotales':
      return r.horasTotales != null ? Number(r.horasTotales) : null;
    case 'horasTotalesUnicas':
      return r.horasTotalesUnicas != null ? Number(r.horasTotalesUnicas) : null;
    // Vacío y no 0 cuando el formulario no declara peso: un cero se leería como
    // "produjo nada", que es otra afirmación.
    case 'pesoProduccion': return r.pesoProduccion != null ? Number(r.pesoProduccion) : null;
    case 'proceso': return r.proceso ?? '';
    case 'fecha': {
      if (!r.fecha) return null;
      const d = new Date(r.fecha);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    case 'planta': return r.personalPlanta ?? 0;
    case 'externo': return r.personalExterno ?? 0;
    case 'horaInicio': return soloHora(r.horaInicio);
    case 'horaFin': return soloHora(r.horaFin);
    case 'horas': return r.horasTrabajadas != null ? Number(r.horasTrabajadas) : null;
    case 'observacion': return r.observaciones ?? '';
    default: return '';
  }
}

/** Valor ya formateado para la tabla en pantalla. */
export function valorTexto(r, id) {
  switch (id) {
    case 'fecha': {
      const d = valorCrudo(r, 'fecha');
      return d ? d.toLocaleDateString('es-EC') : '—';
    }
    case 'horaInicio':
    case 'horaFin':
      return valorCrudo(r, id) || '—';
    case 'horas':
      return r.horasTrabajadas != null ? Number(r.horasTrabajadas).toFixed(2) : '—';
    case 'pesoProduccion':
      return r.pesoProduccion != null
        ? Number(r.pesoProduccion).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '—';
    case 'formID':
      return r.formID != null ? `#${r.formID}` : '—';
    case 'flujo': {
      // Con símbolos en pantalla: se ve de un vistazo dónde entra y dónde sale
      // cada flujo sin tener que leer la palabra.
      const m = [];
      if (r.esInicio) m.push('▶ Entrada');
      if (r.esCierre) m.push('■ Salida');
      return m.length > 0 ? m.join(' ') : '—';
    }
    case 'horasTotales':
      return r.horasTotales != null ? Number(r.horasTotales).toFixed(2) : '—';
    case 'horasTotalesUnicas':
      return r.horasTotalesUnicas != null ? Number(r.horasTotalesUnicas).toFixed(2) : '—';
    case 'pesoTotal':
      return r.pesoTotalFormulario != null
        ? Number(r.pesoTotalFormulario).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '—';
    case 'pesoTotalUnico':
      return r.pesoTotalUnico != null
        ? Number(r.pesoTotalUnico).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '—';
    // Guion en vez de celda vacía. Una celda en blanco se lee como "todavía no
    // lo llenaron" o como un error de la pantalla; el guion dice "ese
    // formulario no registra este dato", que es lo que pasa de verdad.
    case 'destino':
    case 'lote':
    case 'especie':
    case 'codigo':
    case 'proceso': {
      const v = String(valorCrudo(r, id) ?? '').trim();
      return v || '—';
    }
    default:
      return valorCrudo(r, id);
  }
}

export const configPorDefecto = () =>
  COLUMNAS_PERSONAL.map(c => ({ id: c.id, visible: !c.ocultaPorDefecto }));

/**
 * Reconcilia lo guardado en el navegador contra las columnas que existen hoy
 * en el código. Sin esto, una columna renombrada o eliminada dejaría la tabla
 * rota para todo usuario que ya tuviera preferencias guardadas.
 */
export function normalizarConfig(guardada) {
  if (!Array.isArray(guardada)) return configPorDefecto();

  const validas = new Set(COLUMNAS_PERSONAL.map(c => c.id));
  const vistas = new Set();
  const salida = [];

  for (const item of guardada) {
    const id = item?.id;
    if (!validas.has(id) || vistas.has(id)) continue;
    vistas.add(id);
    salida.push({ id, visible: item.visible !== false });
  }

  // Columnas nuevas que este usuario nunca vio. Se insertan en la posición que
  // tienen en la definición, no al final: si no, Código y N° Registro
  // aparecerían después de Observación para quien ya tenía preferencias.
  for (let i = 0; i < COLUMNAS_PERSONAL.length; i++) {
    const c = COLUMNAS_PERSONAL[i];
    if (vistas.has(c.id)) continue;
    salida.splice(Math.min(i, salida.length), 0, { id: c.id, visible: !c.ocultaPorDefecto });
  }

  // Si quedó todo oculto la tabla no se entendería: se vuelve al default.
  return salida.some(c => c.visible) ? salida : configPorDefecto();
}

export function leerConfigGuardada() {
  try {
    return normalizarConfig(JSON.parse(localStorage.getItem(STORAGE_COLUMNAS)));
  } catch {
    return configPorDefecto();
  }
}

export function guardarConfig(config) {
  try {
    localStorage.setItem(STORAGE_COLUMNAS, JSON.stringify(config));
  } catch {
    // Modo privado o cuota llena: la preferencia se pierde al recargar,
    // pero la página tiene que seguir funcionando igual.
  }
}