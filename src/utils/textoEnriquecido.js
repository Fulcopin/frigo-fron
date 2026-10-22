/**
 * Texto enriquecido sencillo para notas / advertencias de las plantillas.
 *
 * Marcas que se interpretan (se pueden combinar):
 *   **negrita**            *cursiva*            __subrayado__
 *   ***negrita + cursiva***
 *   # Título               ## Subtítulo        ### Subtítulo menor
 *   - viñeta               1. viñeta numerada
 *
 * El texto se guarda tal cual en `contenido` / `staticContent`, así que las
 * plantillas y los formularios ya llenados siguen siendo compatibles: si una
 * nota no tiene marcas se ve igual que antes.
 */

// ***...*** | **...** | __...__ | *...*
// La cursiva exige que no empiece ni termine en espacio para no romper cosas
// como "2 * 3" o "FOR_CC_07".
const RE_MARCADO = /(\*\*\*[^*\n]+\*\*\*|\*\*[^*\n]+\*\*|__[^_\n]+__|\*(?!\s)[^*\n]*?[^\s*]\*)/g;
const RE_MARCADO_TEST = /(\*\*\*[^*\n]+\*\*\*|\*\*[^*\n]+\*\*|__[^_\n]+__|\*(?!\s)[^*\n]*?[^\s*]\*)/;

/** ¿El texto tiene alguna marca de formato? */
export function tieneMarcas(texto) {
  return RE_MARCADO_TEST.test(String(texto ?? ''));
}

/**
 * Convierte una línea en una lista de trozos con su formato.
 * @returns {Array<{texto:string, negrita:boolean, cursiva:boolean, subrayado:boolean}>}
 */
export function tokenizarLinea(linea) {
  const texto = String(linea ?? '');
  const tokens = [];
  let ultimo = 0;
  let m;
  RE_MARCADO.lastIndex = 0;

  while ((m = RE_MARCADO.exec(texto)) !== null) {
    if (m.index > ultimo) {
      tokens.push({ texto: texto.slice(ultimo, m.index), negrita: false, cursiva: false, subrayado: false });
    }
    const bruto = m[0];
    let contenido = bruto;
    let negrita = false;
    let cursiva = false;
    let subrayado = false;

    if (bruto.startsWith('***')) {
      contenido = bruto.slice(3, -3);
      negrita = true;
      cursiva = true;
    } else if (bruto.startsWith('**')) {
      contenido = bruto.slice(2, -2);
      negrita = true;
    } else if (bruto.startsWith('__')) {
      contenido = bruto.slice(2, -2);
      subrayado = true;
    } else {
      contenido = bruto.slice(1, -1);
      cursiva = true;
    }

    tokens.push({ texto: contenido, negrita, cursiva, subrayado });
    ultimo = m.index + bruto.length;
  }

  if (ultimo < texto.length) {
    tokens.push({ texto: texto.slice(ultimo), negrita: false, cursiva: false, subrayado: false });
  }
  return tokens;
}

/**
 * Divide el texto en bloques (títulos, subtítulos, viñetas y párrafos).
 * @returns {Array<{tipo:string, nivel?:number, marcador?:string, tokens:Array}>}
 */
export function parsearTexto(texto) {
  const crudo = String(texto ?? '').replace(/\r\n?/g, '\n');
  const bloques = [];

  for (const linea of crudo.split('\n')) {
    const limpia = linea.trim();

    if (!limpia) {
      bloques.push({ tipo: 'vacio', tokens: [] });
      continue;
    }

    const titulo = /^(#{1,3})\s+(.*)$/.exec(limpia);
    if (titulo) {
      const nivel = titulo[1].length;
      bloques.push({
        tipo: nivel === 1 ? 'titulo' : nivel === 2 ? 'subtitulo' : 'subtitulo3',
        nivel,
        tokens: tokenizarLinea(titulo[2]),
      });
      continue;
    }

    const vineta = /^([-•*])\s+(.*)$/.exec(limpia);
    if (vineta && !/^\*\*/.test(limpia)) {
      bloques.push({ tipo: 'vineta', marcador: '•', tokens: tokenizarLinea(vineta[2]) });
      continue;
    }

    const numerada = /^(\d+[.)])\s+(.*)$/.exec(limpia);
    if (numerada) {
      bloques.push({ tipo: 'vineta', marcador: numerada[1], tokens: tokenizarLinea(numerada[2]) });
      continue;
    }

    bloques.push({ tipo: 'parrafo', tokens: tokenizarLinea(linea) });
  }

  return bloques;
}

/** Quita todas las marcas y deja texto plano (para Excel, búsquedas, etc.). */
export function quitarFormato(texto) {
  return String(texto ?? '')
    .replace(/\*\*\*([^*\n]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/\*(?!\s)([^*\n]*?[^\s*])\*/g, '$1')
    .replace(/^[ \t]*#{1,3}[ \t]+/gm, '')
    .replace(/^[ \t]*[-•][ \t]+/gm, '');
}

/** Texto plano de una sola línea (sin saltos). */
export function textoPlano(texto) {
  return quitarFormato(texto).replace(/\s+/g, ' ').trim();
}

/* ══════════════════════════════════════════════════════════════════════
 *  Utilidades para PDF (jsPDF)
 * ══════════════════════════════════════════════════════════════════════ */

const RE_PDF_VALIDOS = /[^\x20-\x7E\xA0-\xFF\n\r\t]/g;

/** jsPDF con fuentes estándar solo soporta Latin-1. */
export function limpiarParaPDF(texto) {
  return String(texto ?? '').replace(RE_PDF_VALIDOS, '');
}

const estiloPDF = (token) => {
  if (token.negrita && token.cursiva) return 'bolditalic';
  if (token.negrita) return 'bold';
  if (token.cursiva) return 'italic';
  return 'normal';
};

const altoDeLinea = (tamano) => tamano * 0.5 + 1;

/**
 * Prepara las líneas de un texto enriquecido para dibujarlas con jsPDF,
 * respetando negrita, cursiva, subrayado y títulos.
 *
 * @param {object} doc           instancia de jsPDF
 * @param {string} texto         contenido de la nota
 * @param {number} anchoMax      ancho disponible en mm
 * @param {object} opciones      { tamano, fuenteBase }
 * @returns {Array<{segmentos:Array, alto:number, tamano:number}>}
 */
export function construirLineasPDF(doc, texto, anchoMax, opciones = {}) {
  const tamanoBase = opciones.tamano ?? 8.5;
  const fuenteBase = opciones.fuenteBase ?? 'normal';
  const bloques = parsearTexto(texto);
  const lineas = [];

  const agregarBloque = (tokens, tamano, prefijo, forzarNegrita = false) => {
    const todos = [];
    if (prefijo) todos.push({ texto: prefijo, negrita: false, cursiva: false, subrayado: false });
    for (const t of tokens) {
      todos.push(forzarNegrita ? { ...t, negrita: true } : t);
    }

    let actual = [];
    let ancho = 0;

    const cerrar = () => {
      while (actual.length && /^[ \t]+$/.test(actual[actual.length - 1].texto)) {
        ancho -= actual[actual.length - 1].ancho;
        actual.pop();
      }
      if (actual.length) lineas.push({ segmentos: actual, alto: altoDeLinea(tamano), tamano });
      actual = [];
      ancho = 0;
    };

    for (const token of todos) {
      const partes = String(token.texto ?? '').split(/([ \t]+)/);
      for (const parte of partes) {
        if (!parte) continue;
        const limpio = limpiarParaPDF(parte).replace(/\t/g, ' ');
        if (!limpio) continue;

        doc.setFont('helvetica', estiloPDF(token));
        doc.setFontSize(tamano);
        const anchoParte = doc.getTextWidth(limpio);
        const esEspacio = /^[ ]+$/.test(limpio);

        if (esEspacio) {
          if (actual.length) {
            actual.push({ texto: limpio, estilo: estiloPDF(token), subrayado: false, ancho: anchoParte });
            ancho += anchoParte;
          }
          continue;
        }

        if (actual.length && ancho + anchoParte > anchoMax) cerrar();

        actual.push({
          texto: limpio,
          estilo: estiloPDF(token),
          subrayado: Boolean(token.subrayado),
          ancho: anchoParte,
        });
        ancho += anchoParte;
      }
    }
    cerrar();
  };

  for (const bloque of bloques) {
    if (bloque.tipo === 'vacio') {
      lineas.push({ segmentos: [], alto: altoDeLinea(tamanoBase) * 0.55, tamano: tamanoBase });
      continue;
    }
    if (bloque.tipo === 'titulo') {
      agregarBloque(bloque.tokens, tamanoBase + 2.4, '', true);
      continue;
    }
    if (bloque.tipo === 'subtitulo') {
      agregarBloque(bloque.tokens, tamanoBase + 1.4, '', true);
      continue;
    }
    if (bloque.tipo === 'subtitulo3') {
      agregarBloque(bloque.tokens, tamanoBase + 0.6, '', true);
      continue;
    }
    if (bloque.tipo === 'vineta') {
      agregarBloque(bloque.tokens, tamanoBase, `${bloque.marcador || '•'} `);
      continue;
    }
    agregarBloque(bloque.tokens, tamanoBase, '');
  }

  if (!lineas.length) lineas.push({ segmentos: [], alto: altoDeLinea(tamanoBase), tamano: tamanoBase });

  doc.setFont('helvetica', fuenteBase);
  doc.setFontSize(tamanoBase);
  return lineas;
}

/** Alto total (mm) que ocuparán las líneas. */
export function altoLineasPDF(lineas) {
  return lineas.reduce((total, linea) => total + linea.alto, 0);
}

/**
 * Dibuja las líneas generadas por construirLineasPDF.
 * `y` es la línea base de la primera línea.
 * @returns {number} línea base final
 */
export function dibujarLineasPDF(doc, lineas, x, y) {
  let cy = y;
  for (const linea of lineas) {
    let cx = x;
    for (const segmento of linea.segmentos) {
      doc.setFont('helvetica', segmento.estilo);
      doc.setFontSize(linea.tamano);
      doc.text(segmento.texto, cx, cy);
      if (segmento.subrayado && segmento.ancho > 0) {
        const grosorPrevio = doc.getLineWidth();
        doc.setLineWidth(0.15);
        doc.line(cx, cy + 0.9, cx + segmento.ancho, cy + 0.9);
        doc.setLineWidth(grosorPrevio);
      }
      cx += segmento.ancho;
    }
    cy += linea.alto;
  }
  return cy;
}

/* ══════════════════════════════════════════════════════════════════════
 *  Utilidades para Excel (ExcelJS)
 * ══════════════════════════════════════════════════════════════════════ */

const fuenteExcel = (token, base) => ({
  ...base,
  bold: Boolean(token.negrita),
  italic: Boolean(token.cursiva),
  underline: Boolean(token.subrayado),
});

/**
 * Convierte una línea en `richText` de ExcelJS.
 * @returns {Array<{text:string, font:object}>}
 */
export function aRichTextExcel(texto, fuente = { name: 'Calibri', size: 10 }) {
  const partes = [];

  for (const bloque of parsearTexto(texto)) {
    if (bloque.tipo === 'vacio') continue;

    const esTitulo = bloque.tipo === 'titulo' || bloque.tipo === 'subtitulo' || bloque.tipo === 'subtitulo3';
    const base = esTitulo
      ? { ...fuente, size: (fuente.size ?? 10) + (bloque.tipo === 'titulo' ? 2 : 1), bold: true }
      : fuente;

    if (partes.length) partes.push({ text: '\n', font: base });
    if (bloque.tipo === 'vineta') partes.push({ text: `${bloque.marcador || '•'} `, font: base });

    for (const token of bloque.tokens) {
      partes.push({ text: token.texto, font: fuenteExcel(token, base) });
    }
  }

  return partes.length ? partes : [{ text: '', font: fuente }];
}

/* ══════════════════════════════════════════════════════════════════════
 *  Utilidades para HTML (impresión / ventanas emergentes)
 * ══════════════════════════════════════════════════════════════════════ */

const escaparHtml = (texto) =>
  String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Convierte el texto con marcas a HTML simple (para imprimir / documento nuevo). */
export function aHtml(texto) {
  const bloques = parsearTexto(texto);
  let html = '';
  let enLista = false;

  const cerrarLista = () => {
    if (enLista) {
      html += '</ul>';
      enLista = false;
    }
  };

  for (const bloque of bloques) {
    if (bloque.tipo === 'vacio') {
      cerrarLista();
      html += '<div style="height:6px"></div>';
      continue;
    }

    if (bloque.tipo === 'vineta') {
      if (!enLista) {
        html += '<ul style="margin:2px 0 2px 18px;padding:0">';
        enLista = true;
      }
      html += `<li>${bloque.tokens.map(htmlDeToken).join('')}</li>`;
      continue;
    }

    cerrarLista();

    if (bloque.tipo === 'titulo' || bloque.tipo === 'subtitulo' || bloque.tipo === 'subtitulo3') {
      const tamano = bloque.tipo === 'titulo' ? 13 : bloque.tipo === 'subtitulo' ? 12 : 11;
      html += `<div style="font-weight:800;font-size:${tamano}px;margin:4px 0 2px">${bloque.tokens.map(htmlDeToken).join('')}</div>`;
      continue;
    }

    html += `<div>${bloque.tokens.map(htmlDeToken).join('')}</div>`;
  }

  cerrarLista();
  return html;
}

function htmlDeToken(token) {
  let html = escaparHtml(token.texto);
  if (token.cursiva) html = `<em>${html}</em>`;
  if (token.negrita) html = `<strong>${html}</strong>`;
  if (token.subrayado) html = `<u>${html}</u>`;
  return html;
}
