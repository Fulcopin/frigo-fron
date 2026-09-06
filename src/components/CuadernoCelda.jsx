import React from 'react';
import PropTypes from 'prop-types';
import { signoDe, valoresDe } from '../utils/calculoCelda';

/**
 * 📓 Cuaderno de la celda (solo lectura).
 *
 * Muestra de qué números salió el valor de una celda ya guardada: los mismos
 * cuadritos que tecleó el operario, la operación y el total. Es lo que antes
 * vivía en el celular de quien pesaba y se perdía apenas se transcribía el
 * resultado — cuando un peso no cuadra, esto es lo primero que se mira.
 *
 * Para EDITAR está CalculadoraCelda; acá solo se consulta, así que se puede
 * abrir desde una pantalla de solo lectura sin riesgo de tocar el dato.
 */
const CuadernoCelda = ({
  abierta,
  titulo = '',
  detalle,
  resultado = '',
  // El mismo cuadrito sirve para una celda y para el total de un lote: solo
  // cambia el encabezado y cómo se llama cada renglón.
  encabezado = '📓 Cuaderno de la celda',
  etiquetaValores = '✏️ Valores anotados',
  nota = 'así se calculó lo que está en la celda',
  onCerrar,
}) => {
  if (!abierta || !detalle) return null;

  const valores = valoresDe(detalle);
  const signo = signoDe(detalle.op);
  const expresion = valores.join(` ${signo} `);

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 4000,
        background: 'rgba(15,23,42,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
    >
      <div style={{
        background: 'white', borderRadius: '14px', width: '100%', maxWidth: '420px',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #0e7490, #0891b2)', color: 'white',
          padding: '14px 18px', borderRadius: '14px 14px 0 0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>{encabezado}</div>
            <div style={{ fontSize: '12px', opacity: 0.9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {titulo}
            </div>
          </div>
          <button
            type="button" onClick={onCerrar} title="Cerrar"
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', width: '30px', height: '30px', fontSize: '16px', cursor: 'pointer', flexShrink: 0 }}
          >✕</button>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0e7490', marginBottom: '6px' }}>
              {etiquetaValores}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <tbody>
                {valores.map((v, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '6px 8px', color: '#64748b', width: '52px' }}>#{i + 1}</td>
                    <td style={{ padding: '6px 8px', color: '#94a3b8', width: '28px', textAlign: 'center' }}>
                      {i === 0 ? '' : signo}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ background: '#ecfeff', border: '1.5px solid #a5f3fc', borderRadius: '8px', padding: '10px 12px' }}>
            <div style={{ fontSize: '12px', color: '#0e7490', wordBreak: 'break-word' }}>{expresion} =</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0e7490' }}>{resultado || '—'}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              {valores.length} valor(es) · {nota}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button" onClick={onCerrar}
              style={{ padding: '9px 18px', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, background: '#0891b2', color: 'white', cursor: 'pointer' }}
            >Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
};

CuadernoCelda.propTypes = {
  abierta: PropTypes.bool,
  titulo: PropTypes.string,
  encabezado: PropTypes.string,
  etiquetaValores: PropTypes.string,
  nota: PropTypes.string,
  /** { op: '+', valores: ['12.5','8'] } */
  detalle: PropTypes.shape({
    op: PropTypes.string,
    valores: PropTypes.arrayOf(PropTypes.string),
  }),
  resultado: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onCerrar: PropTypes.func.isRequired,
};

export default CuadernoCelda;
