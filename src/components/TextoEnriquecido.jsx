import { parsearTexto } from '../utils/textoEnriquecido';

/**
 * Muestra texto con formato simple (**negrita**, *cursiva*, __subrayado__,
 * # Título, ## Subtítulo, - viñeta).
 *
 * props:
 *   texto     → contenido a mostrar
 *   style     → estilos del contenedor
 *   className → clase del contenedor
 *   enLinea   → true para usarlo dentro de un párrafo (no crea bloques)
 */
export default function TextoEnriquecido({ texto, style, className, enLinea = false }) {
  const contenido = String(texto ?? '');
  if (!contenido.trim()) return null;

  const bloques = parsearTexto(contenido);

  const trozos = (tokens) =>
    tokens.map((token, i) => {
      const marcas = [];
      if (token.subrayado) marcas.push(<u key={`u-${i}`}>{token.texto}</u>);
      const base = marcas.length ? marcas : token.texto;
      if (token.negrita && token.cursiva) return <strong key={i}><em>{base}</em></strong>;
      if (token.negrita) return <strong key={i}>{base}</strong>;
      if (token.cursiva) return <em key={i}>{base}</em>;
      return <span key={i}>{base}</span>;
    });

  if (enLinea) {
    return (
      <span className={className} style={style}>
        {bloques.map((bloque, i) => {
          const salto = i < bloques.length - 1 ? <br key={`br-${i}`} /> : null;
          if (bloque.tipo === 'vacio') return <span key={i}>{salto}</span>;
          if (bloque.tipo === 'titulo' || bloque.tipo === 'subtitulo' || bloque.tipo === 'subtitulo3') {
            return (
              <span key={i}>
                <strong>{trozos(bloque.tokens)}</strong>
                {salto}
              </span>
            );
          }
          if (bloque.tipo === 'vineta') {
            return (
              <span key={i}>
                <span style={{ marginRight: 4 }}>{bloque.marcador || '•'}</span>
                {trozos(bloque.tokens)}
                {salto}
              </span>
            );
          }
          return (
            <span key={i}>
              {trozos(bloque.tokens)}
              {salto}
            </span>
          );
        })}
      </span>
    );
  }

  return (
    <div className={className} style={style}>
      {bloques.map((bloque, i) => {
        if (bloque.tipo === 'vacio') {
          return <div key={i} style={{ height: '0.55em' }} />;
        }
        if (bloque.tipo === 'titulo') {
          return (
            <div key={i} style={{ fontWeight: 800, fontSize: '1.16em', lineHeight: 1.35, margin: '2px 0 1px' }}>
              {trozos(bloque.tokens)}
            </div>
          );
        }
        if (bloque.tipo === 'subtitulo') {
          return (
            <div key={i} style={{ fontWeight: 700, fontSize: '1.06em', lineHeight: 1.4, margin: '2px 0 1px' }}>
              {trozos(bloque.tokens)}
            </div>
          );
        }
        if (bloque.tipo === 'subtitulo3') {
          return (
            <div key={i} style={{ fontWeight: 700, fontSize: '1em', lineHeight: 1.45 }}>
              {trozos(bloque.tokens)}
            </div>
          );
        }
        if (bloque.tipo === 'vineta') {
          return (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ flex: '0 0 auto', minWidth: '1em' }}>{bloque.marcador || '•'}</span>
              <span style={{ flex: '1 1 auto' }}>{trozos(bloque.tokens)}</span>
            </div>
          );
        }
        return (
          <div key={i} style={{ margin: 0 }}>
            {trozos(bloque.tokens)}
          </div>
        );
      })}
    </div>
  );
}
