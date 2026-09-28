import '../pages/Novedades.css';

const ICONO = { urgente: '🚨', importante: '⚠️', info: 'ℹ️' };

const fecha = (f) => {
  if (!f) return '';
  const d = new Date(f);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/**
 * Una novedad, como la ve cualquier usuario.
 * @param {object}  novedad
 * @param {boolean} [nueva]  muestra la marca "NUEVA"
 * @param {React.ReactNode} [acciones]  botones extra (solo administración)
 */
export default function NovedadTarjeta({ novedad, nueva = false, acciones = null, estado = null }) {
  const imp = String(novedad?.importancia || 'info').toLowerCase();
  return (
    <article className={`nov-tarjeta nov-${imp}`}>
      <header className="nov-tarjeta-cabecera">
        <span className="nov-icono" aria-hidden="true">{ICONO[imp] || ICONO.info}</span>
        <h3 className="nov-titulo">{novedad?.titulo}</h3>
        {nueva && <span className="nov-marca-nueva">NUEVA</span>}
        {estado && novedad?.mostrarAlEntrar !== false && (
          <span className="nov-estado nov-estado-pantalla" title="Se muestra en pantalla completa al entrar">📺 Al entrar</span>
        )}
        {estado && <span className={`nov-estado nov-estado-${estado.clave}`}>{estado.texto}</span>}
      </header>

      {/* pre-wrap: se respetan los saltos de línea que escribió el administrador */}
      <p className="nov-mensaje">{novedad?.mensaje}</p>

      <footer className="nov-pie">
        <span>
          ✍️ {novedad?.creadoPorNombre || novedad?.creadoPor || 'Administración'} · {fecha(novedad?.createdAt)}
          {novedad?.actualizadoPor && novedad?.updatedAt && (
            <> · editada por {novedad.actualizadoPor} el {fecha(novedad.updatedAt)}</>
          )}
        </span>
        {acciones && <div className="nov-acciones">{acciones}</div>}
      </footer>
    </article>
  );
}
