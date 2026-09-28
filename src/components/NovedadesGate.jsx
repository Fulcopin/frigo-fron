import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import NovedadTarjeta from './NovedadTarjeta';
import { hayQueRevisar, obtenerPendientes, marcarLeidas, usuarioActual } from '../services/novedadesService';
import '../pages/Novedades.css';

/**
 * 📢 PUERTA DE NOVEDADES
 *
 * Envuelve las pantallas protegidas. Si el usuario tiene novedades GRANDES
 * (marcadas "📺 mostrar al entrar") sin leer, las ve ANTES de la pantalla a la que iba (también si entró directo a un
 * reporte desde un enlace, sin pasar por Inicio). Al confirmar, quedan
 * registradas como leídas y sigue a donde iba.
 *
 * Si el servidor no responde, deja pasar: un aviso no puede impedir trabajar.
 */
export default function NovedadesGate({ children }) {
  const location = useLocation();
  const excluida = location.pathname.startsWith('/novedades') || location.pathname === '/login';

  const [pendientes, setPendientes] = useState([]);
  const [cargando, setCargando] = useState(() => !excluida && hayQueRevisar());
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vigente = true;
    if (excluida || !hayQueRevisar()) {
      setCargando(false);
      return undefined;
    }
    setCargando(true);
    obtenerPendientes({ soloPantalla: true })
      .then((lista) => { if (vigente) setPendientes(lista); })
      .catch((e) => console.warn('📢 No se pudieron revisar las novedades:', e))
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [location.pathname, excluida]);

  const continuar = async () => {
    setGuardando(true);
    try {
      await marcarLeidas(pendientes.map((n) => n.id));
    } catch (e) {
      // Se deja pasar igual; la próxima vez se vuelven a mostrar.
      console.warn('📢 No se pudo registrar la lectura:', e);
    } finally {
      setGuardando(false);
      setPendientes([]);
    }
  };

  if (cargando) {
    return <div className="nov-cargando">📢 Revisando novedades…</div>;
  }

  if (!excluida && pendientes.length > 0) {
    const { nombre } = usuarioActual();
    return (
      <div className="nov-previa" role="dialog" aria-modal="true" aria-labelledby="nov-previa-titulo">
        <div className="nov-previa-caja">
          <h1 id="nov-previa-titulo" className="nov-previa-titulo">📢 Novedades</h1>
          <p className="nov-previa-sub">
            {nombre ? `${nombre}, antes` : 'Antes'} de continuar, lee {pendientes.length === 1
              ? 'esta novedad' : `estas ${pendientes.length} novedades`} de la administración.
          </p>

          <div className="nov-lista">
            {pendientes.map((n) => <NovedadTarjeta key={n.id} novedad={n} nueva />)}
          </div>

          <button type="button" className="nov-boton-continuar" onClick={continuar} disabled={guardando} autoFocus>
            {guardando ? 'Guardando…' : '✅ Leído, continuar'}
          </button>
        </div>
      </div>
    );
  }

  return children;
}
