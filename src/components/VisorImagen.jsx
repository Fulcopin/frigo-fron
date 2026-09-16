// ====================================
// VISOR DE IMÁGENES
// ====================================
// Las imágenes de los formularios —fotos del producto, etiquetas, firmas— se
// muestran en miniatura. Para revisar de verdad un registro hay que poder
// verlas grandes, y hasta ahora la única opción era abrirlas en otra pestaña,
// que saca al usuario del formulario y le hace perder dónde estaba.
//
// Acá se abren sobre la pantalla, con zoom y descarga, y se cierra con Escape
// o tocando afuera. No se pierde el lugar en el formulario.

import { useState, useEffect, useCallback } from 'react';
import './VisorImagen.css';

const ZOOMS = [1, 1.5, 2, 3, 4];

/**
 * @param {string}   src      URL o base64 de la imagen
 * @param {string}   [titulo] qué se está viendo, para el encabezado
 * @param {Function} onClose
 */
export default function VisorImagen({ src, titulo, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [arrastrando, setArrastrando] = useState(null);

  const cerrar = useCallback(() => {
    setZoom(1);
    setPos({ x: 0, y: 0 });
    onClose?.();
  }, [onClose]);

  // Escape para cerrar y +/- para el zoom: quien revisa muchos registros
  // seguidos no quiere ir al mouse en cada uno.
  useEffect(() => {
    const tecla = (e) => {
      if (e.key === 'Escape') cerrar();
      if (e.key === '+' || e.key === '=') setZoom(z => ZOOMS[Math.min(ZOOMS.indexOf(z) + 1, ZOOMS.length - 1)] ?? z);
      if (e.key === '-') setZoom(z => ZOOMS[Math.max(ZOOMS.indexOf(z) - 1, 0)] ?? z);
    };
    document.addEventListener('keydown', tecla);

    // Sin esto la página de atrás se desplaza mientras se mira la imagen y al
    // cerrar el usuario aparece en otro lugar del formulario.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = overflowPrevio;
    };
  }, [cerrar]);

  if (!src) return null;

  const siguienteZoom = () => {
    const i = ZOOMS.indexOf(zoom);
    const nuevo = ZOOMS[(i + 1) % ZOOMS.length];
    setZoom(nuevo);
    if (nuevo === 1) setPos({ x: 0, y: 0 });   // al volver al tamaño normal se recentra
  };

  // Arrastrar para mover la imagen ampliada. Sin esto, con zoom 4x solo se ve
  // el centro y no hay forma de llegar a los bordes.
  const alPresionar = (e) => {
    if (zoom === 1) return;
    const p = e.touches?.[0] ?? e;
    setArrastrando({ x: p.clientX - pos.x, y: p.clientY - pos.y });
  };
  const alMover = (e) => {
    if (!arrastrando) return;
    const p = e.touches?.[0] ?? e;
    setPos({ x: p.clientX - arrastrando.x, y: p.clientY - arrastrando.y });
  };
  const alSoltar = () => setArrastrando(null);

  return (
    <div className="vi-fondo" onClick={cerrar}>
      <div className="vi-barra" onClick={(e) => e.stopPropagation()}>
        <span className="vi-titulo">{titulo || 'Imagen del registro'}</span>

        <div className="vi-acciones">
          <button type="button" onClick={siguienteZoom} title="Cambiar el zoom (o teclas + y -)">
            🔍 {zoom}x
          </button>
          <a href={src} download target="_blank" rel="noopener noreferrer" title="Descargar la imagen">
            ⬇️
          </a>
          <button type="button" onClick={cerrar} title="Cerrar (Escape)">✕</button>
        </div>
      </div>

      <div
        className="vi-lienzo"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={alPresionar}
        onMouseMove={alMover}
        onMouseUp={alSoltar}
        onMouseLeave={alSoltar}
        onTouchStart={alPresionar}
        onTouchMove={alMover}
        onTouchEnd={alSoltar}
      >
        <img
          src={src}
          alt={titulo || 'Imagen'}
          className="vi-img"
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})`,
            cursor: zoom === 1 ? 'zoom-in' : (arrastrando ? 'grabbing' : 'grab'),
          }}
          onDoubleClick={siguienteZoom}
          onClick={(e) => { e.stopPropagation(); if (zoom === 1) siguienteZoom(); }}
          draggable={false}
        />
      </div>

      <div className="vi-pie" onClick={(e) => e.stopPropagation()}>
        Doble clic para acercar · arrastrá para moverla · Escape para cerrar
      </div>
    </div>
  );
}
