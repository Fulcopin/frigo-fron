import React from 'react';
import './AccordionSection.css';

const AccordionSection = ({ 
  title, 
  icon, 
  badge, 
  isExpanded, 
  onToggle, 
  children,
  className = ''
}) => {
  // ⚡ PREVENIR SCROLL AUTOMÁTICO AL TOGGLE
  const handleToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const currentScroll = window.scrollY;
    onToggle();
    // Mantener la posición actual
    requestAnimationFrame(() => {
      window.scrollTo({ top: currentScroll, behavior: 'auto' });
    });
  };

  return (
    <div 
      className={`accordion-section ${isExpanded ? 'expanded' : 'collapsed'} ${className}`}
      style={{ scrollMargin: 0, scrollPadding: 0 }}
    >
      <div className="accordion-header" onClick={handleToggle}>
        <div className="accordion-title">
          {icon && <span className="accordion-icon">{icon}</span>}
          <span className="accordion-title-text">{title}</span>
          {badge && <span className="accordion-badge">{badge}</span>}
        </div>
        <button 
          type="button"
          className="accordion-toggle"
          onClick={handleToggle}
        >
          <span className="toggle-text">{isExpanded ? 'Ocultar' : 'Mostrar'}</span>
          <span className="toggle-icon">▼</span>
        </button>
      </div>
      <div className="accordion-content">
        {children}
      </div>
    </div>
  );
};

export default AccordionSection;
