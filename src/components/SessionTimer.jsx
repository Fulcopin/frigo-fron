import React, { useState, useEffect } from 'react';
import sessionTimeService from '../services/sessionTimeService';
import './SessionTimer.css';

/**
 * ⏱️ SessionTimer - Cronómetro de tiempo de sesión visible en el navbar
 * Muestra el tiempo que lleva el usuario conectado en la sesión actual.
 */
const SessionTimer = () => {
  const [elapsed, setElapsed] = useState('00m 00s');
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const start = sessionTimeService.getSessionStart();
    if (!start) {
      setIsActive(false);
      return;
    }

    setIsActive(true);

    const updateTimer = () => {
      const ms = sessionTimeService.getCurrentDuration();
      setElapsed(sessionTimeService.formatDuration(ms));
    };

    // Actualizar inmediatamente
    updateTimer();

    // Actualizar cada segundo
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!isActive) return null;

  return (
    <div className="session-timer" title="Tiempo de sesión activa">
      <span className="timer-icon">⏱️</span>
      <span className="timer-value">{elapsed}</span>
    </div>
  );
};

export default SessionTimer;
