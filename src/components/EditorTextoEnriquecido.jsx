import { useRef } from 'react';

/**
 * Área de texto con barra de formato para las notas de la plantilla.
 *
 * Guarda el texto con marcas simples (**negrita**, *cursiva*, __subrayado__,
 * # Título, ## Subtítulo, - viñeta), así que no cambia el formato de datos
 * que ya usan las plantillas y los formularios llenados.
 */
export default function EditorTextoEnriquecido({
  value,
  onChange,
  rows = 6,
  placeholder = '',
  style,
  id,
}) {
  const ref = useRef(null);

  const seleccionar = (inicio, fin) => {
    window.requestAnimationFrame(() => {
      const ta = ref.current;
      if (!ta) return;
      ta.focus();
      try {
        ta.setSelectionRange(inicio, fin);
      } catch {
        /* el textarea pudo desmontarse */
      }
    });
  };

  const envolver = (izq, der) => {
    const ta = ref.current;
    if (!ta) return;
    const texto = value || '';
    const a = ta.selectionStart ?? texto.length;
    const b = ta.selectionEnd ?? texto.length;
    const sel = texto.slice(a, b);
    const antes = texto.slice(Math.max(0, a - izq.length), a);
    const despues = texto.slice(b, b + der.length);

    // Ya está envuelto por fuera → quitar
    if (antes === izq && despues === der) {
      onChange(texto.slice(0, a - izq.length) + sel + texto.slice(b + der.length));
      seleccionar(a - izq.length, b - izq.length);
      return;
    }

    // La selección ya incluye las marcas → quitar
    if (sel.length >= izq.length + der.length && sel.startsWith(izq) && sel.endsWith(der)) {
      const limpio = sel.slice(izq.length, sel.length - der.length);
      onChange(texto.slice(0, a) + limpio + texto.slice(b));
      seleccionar(a, a + limpio.length);
      return;
    }

    onChange(texto.slice(0, a) + izq + sel + der + texto.slice(b));
    if (sel.length) {
      seleccionar(a + izq.length, b + izq.length);
    } else {
      seleccionar(a + izq.length, a + izq.length);
    }
  };

  const prefijar = (prefijo, patron) => {
    const ta = ref.current;
    if (!ta) return;
    const texto = value || '';
    const a = ta.selectionStart ?? texto.length;
    const b = ta.selectionEnd ?? texto.length;

    const iniBloque = texto.lastIndexOf('\n', Math.max(0, a - 1)) + 1;
    let finBloque = texto.indexOf('\n', b);
    if (finBloque === -1) finBloque = texto.length;

    const bloque = texto.slice(iniBloque, finBloque);
    const lineas = bloque.split('\n');
    const conContenido = lineas.filter((l) => l.trim());
    const todasConPrefijo = conContenido.length > 0 && conContenido.every((l) => patron.test(l.trim()));

    const nuevas = lineas.map((linea) => {
      const limpia = linea.trim();
      if (!limpia) return linea;
      if (todasConPrefijo) return linea.replace(patron, '');
      const sinOtros = limpia.replace(/^(#{1,3}\s+|[-•*]\s+|\d+[.)]\s+)/, '');
      return sinOtros === limpia ? prefijo + limpia : prefijo + sinOtros;
    });

    const nuevoBloque = nuevas.join('\n');
    onChange(texto.slice(0, iniBloque) + nuevoBloque + texto.slice(finBloque));
    seleccionar(iniBloque, iniBloque + nuevoBloque.length);
  };

  const limpiar = () => {
    const ta = ref.current;
    if (!ta) return;
    const a = ta.selectionStart ?? 0;
    const b = ta.selectionEnd ?? 0;
    const texto = value || '';
    const inicio = a === b ? 0 : a;
    const fin = a === b ? texto.length : b;
    const objetivo = texto.slice(inicio, fin);
    const limpio = objetivo
      .replace(/\*\*\*([^*\n]+)\*\*\*/g, '$1')
      .replace(/\*\*([^*\n]+)\*\*/g, '$1')
      .replace(/__([^_\n]+)__/g, '$1')
      .replace(/\*(?!\s)([^*\n]*?[^\s*])\*/g, '$1')
      .replace(/^[ \t]*#{1,3}[ \t]+/gm, '')
      .replace(/^[ \t]*[-•*][ \t]+/gm, '');
    onChange(texto.slice(0, inicio) + limpio + texto.slice(fin));
    seleccionar(inicio, inicio + limpio.length);
  };

  const alTeclear = (e) => {
    const conCtrl = e.ctrlKey || e.metaKey;
    if (!conCtrl) return;
    const tecla = e.key.toLowerCase();
    if (tecla === 'b') {
      e.preventDefault();
      envolver('**', '**');
    } else if (tecla === 'i') {
      e.preventDefault();
      envolver('*', '*');
    } else if (tecla === 'u') {
      e.preventDefault();
      envolver('__', '__');
    }
  };

  const boton = (etiqueta, titulo, accion, extra = {}) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={accion}
      title={titulo}
      style={{
        border: '1px solid #d97706',
        background: '#fff7ed',
        color: '#78350f',
        borderRadius: 6,
        padding: '4px 9px',
        fontSize: '0.78rem',
        fontWeight: 700,
        cursor: 'pointer',
        lineHeight: 1.2,
        ...extra,
      }}
    >
      {etiqueta}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          alignItems: 'center',
          background: '#fffbeb',
          border: '1px solid #fcd34d',
          borderRadius: 6,
          padding: '5px 7px',
        }}
      >
        {boton(<strong>N</strong>, 'Negrita (Ctrl+B)', () => envolver('**', '**'))}
        {boton(<em>C</em>, 'Cursiva (Ctrl+I)', () => envolver('*', '*'))}
        {boton(<u>S</u>, 'Subrayado (Ctrl+U)', () => envolver('__', '__'))}
        <span style={{ width: 1, height: 18, background: '#fcd34d' }} />
        {boton('Título', 'Título grande (# )', () => prefijar('# ', /^#\s+/), { fontSize: '0.74rem' })}
        {boton('Subtítulo', 'Subtítulo (## )', () => prefijar('## ', /^##\s+/), { fontSize: '0.74rem' })}
        {boton('• Viñeta', 'Viñeta (- )', () => prefijar('- ', /^-\s+/), { fontSize: '0.74rem' })}
        <span style={{ width: 1, height: 18, background: '#fcd34d' }} />
        {boton('🧹', 'Quitar formato (a todo el texto si no hay selección)', limpiar)}
      </div>

      <textarea
        id={id}
        ref={ref}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={alTeclear}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: '100%',
          padding: '10px 12px',
          fontSize: '0.88rem',
          border: '2px solid #d97706',
          borderRadius: 6,
          background: '#fffbeb',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
          resize: 'vertical',
          lineHeight: 1.6,
          ...style,
        }}
      />
    </div>
  );
}
