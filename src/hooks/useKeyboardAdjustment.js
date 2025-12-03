import { useEffect } from 'react';

/**
 * Hook para manejar el auto-scroll cuando aparece el teclado virtual
 * y un input recibe el foco en dispositivos táctiles
 */
export const useKeyboardAdjustment = () => {
  useEffect(() => {
    const handleFocus = (e) => {
      const target = e.target;
      
      // Solo aplicar para inputs, textareas y selects
      if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      // Esperar a que el teclado aparezca
      setTimeout(() => {
        const rect = target.getBoundingClientRect();
        const viewportHeight = window.visualViewport?.height || window.innerHeight;
        const scrollOffset = 150; // Espacio extra para ver el campo cómodamente

        // Si el campo está en la mitad inferior de la pantalla visible
        if (rect.bottom > viewportHeight * 0.5) {
          // Calcular cuánto scroll necesitamos
          const scrollAmount = rect.top - scrollOffset;
          
          window.scrollBy({
            top: scrollAmount,
            behavior: 'smooth'
          });

          // Agregar clase al elemento padre para indicar que está enfocado
          const formSection = target.closest('.accordion-section, .form-section');
          if (formSection) {
            formSection.classList.add('field-focused');
          }
        }
      }, 300); // Delay para esperar la animación del teclado
    };

    const handleBlur = (e) => {
      const target = e.target;
      
      // Remover clase de enfoque
      const formSection = target.closest('.accordion-section, .form-section');
      if (formSection) {
        formSection.classList.remove('field-focused');
      }
    };

    // Agregar listeners
    document.addEventListener('focus', handleFocus, true);
    document.addEventListener('blur', handleBlur, true);

    // Manejar cambios en el tamaño del viewport (cuando aparece/desaparece el teclado)
    const handleResize = () => {
      // Asegurarse de que el campo enfocado siga visible
      const activeElement = document.activeElement;
      if (activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName)) {
        const rect = activeElement.getBoundingClientRect();
        const viewportHeight = window.visualViewport?.height || window.innerHeight;
        
        if (rect.bottom > viewportHeight - 50) {
          activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }

    // Cleanup
    return () => {
      document.removeEventListener('focus', handleFocus, true);
      document.removeEventListener('blur', handleBlur, true);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, []);
};

export default useKeyboardAdjustment;
