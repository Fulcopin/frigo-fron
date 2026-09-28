import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NovedadTarjeta from './NovedadTarjeta';
import { listarVigentes, marcarLeidas, puedePublicar, alCambiar } from '../services/novedadesService';
import '../pages/Novedades.css';

const MAXIMO = 3;

/**
 * 📢 Recuadro de novedades en la pantalla de Inicio.
 * Muestra las más importantes y recientes; lo que se ve aquí cuenta como leído.
 * El administrador tiene además el acceso directo para publicar.
 */
export default function NovedadesInicio() {
  const navigate = useNavigate();
  const esAdmin = puedePublicar();
  const [novedades, setNovedades] = useState([]);
  const [cargado, setCargado] = useState(false);
  // Las que eran nuevas al entrar siguen marcadas "NUEVA" durante esta visita,
  // aunque ya se hayan registrado como leídas.
  const nuevasAlEntrar = useRef(new Set());

  useEffect(() => {
    let vigente = true;
    const cargar = () => {
      listarVigentes()
        .then((lista) => {
          if (!vigente) return;
          lista.filter((n) => n.leida === false).forEach((n) => nuevasAlEntrar.current.add(n.id));
          setNovedades(lista);
          const vistas = lista.slice(0, MAXIMO).filter((n) => n.leida === false).map((n) => n.id);
          if (vistas.length > 0) marcarLeidas(vistas).catch(() => {});
        })
        .catch((e) => console.warn('📢 No se pudieron cargar las novedades del inicio:', e))
        .finally(() => { if (vigente) setCargado(true); });
    };
    cargar();
    // Si se publica algo desde otra parte de la app, se actualiza solo.
    const quitar = alCambiar(() => listarVigentes().then((l) => vigente && setNovedades(l)).catch(() => {}));
    return () => { vigente = false; quitar(); };
  }, []);

  if (!cargado) return null;
  if (novedades.length === 0 && !esAdmin) return null;

  return (
    <section className="nov-inicio" aria-label="Novedades">
      <div className="nov-inicio-cabecera">
        <h2>📢 Novedades</h2>
        <div className="nov-inicio-botones">
          {novedades.length > MAXIMO && (
            <button type="button" onClick={() => navigate('/novedades')}>
              Ver todas ({novedades.length})
            </button>
          )}
          {novedades.length > 0 && novedades.length <= MAXIMO && (
            <button type="button" onClick={() => navigate('/novedades')}>Ver en Novedades</button>
          )}
          {esAdmin && (
            <button type="button" className="nov-inicio-admin" onClick={() => navigate('/novedades?tab=administrar')}>
              ✍️ Publicar novedad
            </button>
          )}
        </div>
      </div>

      {novedades.length === 0 ? (
        <p className="nov-vacio" style={{ padding: '8px 0' }}>
          No hay novedades publicadas. Cuando haya algo importante, publícalo aquí y todos lo verán al entrar.
        </p>
      ) : (
        <div className="nov-lista">
          {novedades.slice(0, MAXIMO).map((n) => (
            <NovedadTarjeta key={n.id} novedad={n} nueva={n.leida === false || nuevasAlEntrar.current.has(n.id)} />
          ))}
        </div>
      )}
    </section>
  );
}
