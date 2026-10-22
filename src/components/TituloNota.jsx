import { tituloVisibleNota } from '../utils/textoEnriquecido';

/**
 * Encabezado de una nota (`elemento.title`).
 * Se muestra centrado, en mayúsculas y más grande que el texto, igual que en
 * el PDF y en el Excel. No dibuja nada si la nota no tiene título.
 */
export default function TituloNota({ title, style }) {
  const texto = tituloVisibleNota(title);
  if (!texto) return null;

  return (
    <div
      style={{
        textAlign: 'center',
        fontWeight: 800,
        fontSize: '1.08rem',
        lineHeight: 1.35,
        letterSpacing: '0.02em',
        color: '#78350f',
        borderBottom: '1.5px solid #d97706',
        paddingBottom: 4,
        marginBottom: 8,
        ...style,
      }}
    >
      {texto}
    </div>
  );
}
