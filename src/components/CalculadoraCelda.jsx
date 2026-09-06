import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * ➕ Calculadora de celda
 *
 * En planta un solo dato de la tabla sale de varias medidas: se pesan cuatro
 * tinas y en la celda va el total. Hoy eso se hace con la calculadora del
 * celular y se transcribe el resultado — y ahí es donde aparecen las
 * diferencias de peso.
 *
 * El operario dice cuántos cuadritos necesita, escribe un número en cada uno,
 * elige la operación y el resultado se escribe en la celda. La celda sigue
 * siendo un número común y corriente para las fórmulas, los totales y el Excel.
 *
 * El detalle (los números y la operación) se devuelve aparte para que quien
 * llama lo guarde junto a la fila: un peso se corrige a cada rato, y sin el
 * desglose habría que acordarse de las cuatro tinas y volver a sumarlas a mano.
 */

// El id es lo que se opera; el signo es lo que se muestra (− y ÷ de verdad, no - y /).
const OPERACIONES = [
  { id: '+', signo: '+', label: 'Sumar',       aplicar: (a, b) => a + b },
  { id: '-', signo: '−', label: 'Restar',      aplicar: (a, b) => a - b },
  { id: '*', signo: '×', label: 'Multiplicar', aplicar: (a, b) => a * b },
  { id: '/', signo: '÷', label: 'Dividir',     aplicar: (a, b) => a / b },
];

const MIN_CUADRITOS = 2;
const MAX_CUADRITOS = 30;

/** "12,5" → 12.5 · vacío o basura → null (el cuadrito vacío no entra en la cuenta) */
const aNumero = (txt) => {
  const limpio = String(txt ?? '').replace(',', '.').trim();
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
};

/** Redondeo a 2 decimales: es la precisión con la que se anotan pesos y libras
 *  en planta, y de paso evita que 0.1 + 0.2 escriba 0.30000000000000004. */
const redondear = (n) => Number(n.toFixed(2));

const CalculadoraCelda = ({ abierta, titulo = 'Celda', valorInicial = '', detalleInicial = null, onAplicar, onCerrar }) => {
  const [cantidad, setCantidad] = useState(MIN_CUADRITOS);
  const [valores, setValores] = useState([]);
  const [operacion, setOperacion] = useState('+');
  const refs = useRef([]);

  // Al abrir hay dos casos: si la celda ya se calculó antes, vuelven los mismos
  // cuadritos para corregirlos; si no, se arranca de cero con el valor que ya
  // tenía la celda en el primero (lo normal es sumarle algo a lo anotado).
  useEffect(() => {
    if (!abierta) return;

    const previos = Array.isArray(detalleInicial?.valores) ? detalleInicial.valores : null;
    if (previos && previos.length > 0) {
      const total = Math.max(MIN_CUADRITOS, Math.min(MAX_CUADRITOS, previos.length));
      setCantidad(total);
      setOperacion(OPERACIONES.some(o => o.id === detalleInicial.op) ? detalleInicial.op : '+');
      setValores(Array.from({ length: total }, (_, i) => String(previos[i] ?? '')));
      setTimeout(() => refs.current[0]?.select(), 50);
      return;
    }

    const inicial = aNumero(valorInicial);
    setCantidad(MIN_CUADRITOS);
    setOperacion('+');
    setValores(inicial !== null ? [String(inicial), ''] : ['', '']);
    setTimeout(() => refs.current[inicial !== null ? 1 : 0]?.focus(), 50);
  }, [abierta, valorInicial, detalleInicial]);

  // Cambiar la cantidad de cuadritos no borra lo ya tecleado.
  const cambiarCantidad = (n) => {
    const total = Math.max(MIN_CUADRITOS, Math.min(MAX_CUADRITOS, Number(n) || MIN_CUADRITOS));
    setCantidad(total);
    setValores(prev => Array.from({ length: total }, (_, i) => prev[i] ?? ''));
  };

  const escribir = (i, txt) => {
    // Solo números, un separador decimal y el signo menos al principio.
    const limpio = txt.replace(/[^\d.,-]/g, '');
    setValores(prev => prev.map((v, idx) => (idx === i ? limpio : v)));
  };

  const cuadritos = Array.from({ length: cantidad }, (_, i) => valores[i] ?? '');
  const numeros = cuadritos.map(aNumero).filter(n => n !== null);
  const op = OPERACIONES.find(o => o.id === operacion) || OPERACIONES[0];

  const divisionPorCero = operacion === '/' && numeros.slice(1).some(n => n === 0);
  const resultado = numeros.length === 0 || divisionPorCero
    ? null
    : redondear(numeros.reduce((acc, n) => op.aplicar(acc, n)));

  const expresion = numeros.length > 0 ? numeros.join(` ${op.signo} `) : '';
  const puedeAplicar = resultado !== null && Number.isFinite(resultado);

  const aplicar = () => {
    if (!puedeAplicar) return;
    // Se devuelve el desglose tal como se tecleó (sin los cuadritos vacíos del
    // final) para poder reabrirlo y corregirlo después.
    const usados = [...cuadritos];
    while (usados.length > MIN_CUADRITOS && String(usados[usados.length - 1] ?? '').trim() === '') usados.pop();
    onAplicar(String(resultado), { op: operacion, valores: usados });
    onCerrar();
  };

  // Enter avanza de cuadrito y aplica en el último: se llena todo sin soltar el
  // teclado. Escape cierra sin tocar la celda.
  const teclas = (e, i) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (i < cantidad - 1) refs.current[i + 1]?.focus();
      else aplicar();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCerrar();
    }
  };

  if (!abierta) return null;

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
        background: 'white', borderRadius: '14px', width: '100%', maxWidth: '460px',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #0e7490, #0891b2)', color: 'white',
          padding: '14px 18px', borderRadius: '14px 14px 0 0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>➕ Calculadora de celda</div>
            <div style={{ fontSize: '12px', opacity: 0.9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {titulo}
            </div>
          </div>
          <button
            type="button" onClick={onCerrar} title="Cerrar (Esc)"
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', width: '30px', height: '30px', fontSize: '16px', cursor: 'pointer', flexShrink: 0 }}
          >✕</button>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#0e7490' }}>🔢 Cuántos cuadritos</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button" onClick={() => cambiarCantidad(cantidad - 1)} disabled={cantidad <= MIN_CUADRITOS}
                  style={{ width: '30px', height: '32px', border: '1.5px solid #a5f3fc', background: '#ecfeff', color: '#0e7490', borderRadius: '6px', fontSize: '16px', fontWeight: 700, cursor: cantidad <= MIN_CUADRITOS ? 'not-allowed' : 'pointer', opacity: cantidad <= MIN_CUADRITOS ? 0.5 : 1 }}
                >−</button>
                <input
                  type="number" min={MIN_CUADRITOS} max={MAX_CUADRITOS} value={cantidad}
                  onChange={(e) => cambiarCantidad(e.target.value)}
                  style={{ width: '64px', padding: '6px 8px', border: '1.5px solid #a5f3fc', borderRadius: '6px', fontSize: '14px', textAlign: 'center' }}
                />
                <button
                  type="button" onClick={() => cambiarCantidad(cantidad + 1)} disabled={cantidad >= MAX_CUADRITOS}
                  style={{ width: '30px', height: '32px', border: '1.5px solid #a5f3fc', background: '#ecfeff', color: '#0e7490', borderRadius: '6px', fontSize: '16px', fontWeight: 700, cursor: cantidad >= MAX_CUADRITOS ? 'not-allowed' : 'pointer', opacity: cantidad >= MAX_CUADRITOS ? 0.5 : 1 }}
                >+</button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '150px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#0e7490' }}>🧮 Operación</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {OPERACIONES.map(o => (
                  <button
                    key={o.id} type="button" title={o.label} onClick={() => setOperacion(o.id)}
                    style={{
                      flex: 1, height: '32px', borderRadius: '6px', fontSize: '17px', fontWeight: 700, cursor: 'pointer',
                      border: `1.5px solid ${operacion === o.id ? '#0891b2' : '#cbd5e1'}`,
                      background: operacion === o.id ? '#0891b2' : 'white',
                      color: operacion === o.id ? 'white' : '#475569',
                    }}
                  >{o.signo}</button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#0e7490', display: 'block', marginBottom: '6px' }}>
              ✏️ Valores
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: '8px' }}>
              {cuadritos.map((v, i) => (
                <input
                  key={i}
                  ref={el => { refs.current[i] = el; }}
                  type="text" inputMode="decimal" value={v}
                  onChange={(e) => escribir(i, e.target.value)}
                  onKeyDown={(e) => teclas(e, i)}
                  placeholder={`#${i + 1}`}
                  style={{
                    width: '100%', padding: '8px', border: '1.5px solid #cbd5e1', borderRadius: '6px',
                    fontSize: '15px', textAlign: 'right', outline: 'none',
                    background: v ? '#f0fdff' : 'white',
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{
            background: divisionPorCero ? '#fef2f2' : '#ecfeff',
            border: `1.5px solid ${divisionPorCero ? '#fca5a5' : '#a5f3fc'}`,
            borderRadius: '8px', padding: '10px 12px',
          }}>
            {divisionPorCero ? (
              <div style={{ color: '#b91c1c', fontWeight: 600, fontSize: '13px' }}>⚠️ No se puede dividir para cero.</div>
            ) : resultado === null ? (
              <div style={{ color: '#64748b', fontSize: '13px' }}>Escribe al menos un valor para ver el resultado.</div>
            ) : (
              <>
                <div style={{ fontSize: '12px', color: '#0e7490', wordBreak: 'break-word' }}>{expresion} =</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0e7490' }}>{resultado}</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  {numeros.length} valor(es) · los cuadritos vacíos no cuentan
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button" onClick={onCerrar}
              style={{ padding: '9px 16px', border: '1.5px solid #cbd5e1', background: 'white', color: '#475569', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
            >Cancelar</button>
            <button
              type="button" onClick={aplicar} disabled={!puedeAplicar}
              style={{
                padding: '9px 18px', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700,
                background: puedeAplicar ? '#0891b2' : '#e2e8f0',
                color: puedeAplicar ? 'white' : '#94a3b8',
                cursor: puedeAplicar ? 'pointer' : 'not-allowed',
              }}
            >✓ Poner en la celda</button>
          </div>
        </div>
      </div>
    </div>
  );
};

CalculadoraCelda.propTypes = {
  abierta: PropTypes.bool,
  titulo: PropTypes.string,
  valorInicial: PropTypes.string,
  /** Cálculo guardado de esta celda: { op: '+', valores: ['12.5','8'] } */
  detalleInicial: PropTypes.shape({
    op: PropTypes.string,
    valores: PropTypes.arrayOf(PropTypes.string),
  }),
  /** (resultado, { op, valores }) => void */
  onAplicar: PropTypes.func.isRequired,
  onCerrar: PropTypes.func.isRequired,
};

export default CalculadoraCelda;
