import React, { useState } from 'react';
import './ScrollButton.css';

/**
 * 🔼🔽 ScrollButton - Botones flotantes para subir/bajar sección por sección
 * 
 * Características:
 * - Botón "Subir" cuando haces scroll hacia abajo
 * - Botón "Bajar" cuando estás arriba
 * - Scroll GRADUAL por secciones (no todo de una vez)
 * - Animación suave
 * - Posición fija en la esquina inferior derecha
 */
const ScrollButton = () => {
  // SIEMPRE mostrar ambos botones
  const [showScrollTop] = useState(true);
  const [showScrollBottom] = useState(true);

  // Altura de cada "sección" para el scroll gradual
  const SCROLL_STEP = typeof window !== 'undefined' ? window.innerHeight * 0.8 : 600;

  /**
   * Subir una sección (80% de la altura de la ventana)
   */
  const scrollUpOneSection = () => {
    const currentScroll = window.scrollY;
    const newScroll = Math.max(0, currentScroll - SCROLL_STEP);
    
    window.scrollTo({
      top: newScroll,
      behavior: 'smooth'
    });
  };

  /**
   * Bajar una sección (80% de la altura de la ventana)
   */
  const scrollDownOneSection = () => {
    const currentScroll = window.scrollY;
    const documentHeight = document.documentElement.scrollHeight;
    const windowHeight = window.innerHeight;
    const maxScroll = documentHeight - windowHeight;
    const newScroll = Math.min(maxScroll, currentScroll + SCROLL_STEP);
    
    window.scrollTo({
      top: newScroll,
      behavior: 'smooth'
    });
  };

  return (
    <>
      {/* Botón SUBIR */}
      {showScrollTop && (
        <button
          className="scroll-btn scroll-btn-top"
          onClick={scrollUpOneSection}
          title="Subir una sección"
          aria-label="Subir una sección"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
          <span className="scroll-btn-text">Subir</span>
        </button>
      )}

      {/* Botón BAJAR */}
      {showScrollBottom && (
        <button
          className="scroll-btn scroll-btn-bottom"
          onClick={scrollDownOneSection}
          title="Bajar una sección"
          aria-label="Bajar una sección"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          <span className="scroll-btn-text">Bajar</span>
        </button>
      )}
    </>
  );
};

export default ScrollButton;
