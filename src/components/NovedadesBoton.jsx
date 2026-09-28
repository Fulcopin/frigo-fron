import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { obtenerPendientes, alCambiar, usuarioActual } from '../services/novedadesService';
import '../pages/Novedades.css';

/**
 * Botón 📢 de la barra superior, con la cantidad de novedades sin leer.
 * Se actualiza al publicar/leer y cada 5 minutos.
 */
export default function NovedadesBoton() {
  const navigate = useNavigate();
  const [sinLeer, setSinLeer] = useState(0);

  useEffect(() => {
    let vigente = true;
    const actualizar = () => {
      if (!usuarioActual().usuario) return;
      obtenerPendientes({ forzar: true })
        .then((l) => { if (vigente) setSinLeer(l.length); })
        .catch(() => {});
    };
    actualizar();
    const reloj = setInterval(actualizar, 5 * 60 * 1000);
    const quitar = alCambiar(actualizar);
    return () => { vigente = false; clearInterval(reloj); quitar(); };
  }, []);

  return (
    <button
      type="button"
      className="nov-boton-barra"
      onClick={() => navigate('/novedades')}
      title={sinLeer > 0 ? `${sinLeer} novedad(es) sin leer` : 'Novedades'}
    >
      📢 Novedades
      {sinLeer > 0 && <span className="nov-contador">{sinLeer}</span>}
    </button>
  );
}
