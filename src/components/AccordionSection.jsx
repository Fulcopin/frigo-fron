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
  return (
    <div className={`accordion-section ${isExpanded ? 'expanded' : 'collapsed'} ${className}`}>
      <div className="accordion-header" onClick={onToggle}>
        <h3 className="accordion-title">
          {icon && <span className="accordion-icon">{icon}</span>}
          {title}
          {badge && <span className="accordion-badge">{badge}</span>}
        </h3>
        <div className="accordion-toggle">
          <span>{isExpanded ? 'Ocultar' : 'Mostrar'}</span>
          <span className="toggle-icon">▼</span>
        </div>
      </div>
      <div className="accordion-content">
        {children}
      </div>
    </div>
  );
};

export default AccordionSection;
