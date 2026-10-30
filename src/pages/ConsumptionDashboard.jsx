import { useState, useEffect, useMemo } from 'react';
import ExcelJS from 'exceljs';
import consumptionService from '../services/consumptionService';
import { Link } from 'react-router-dom';
import './ConsumptionDashboard.css';

export default function ConsumptionDashboard() {
  const [allSectionsData, setAllSectionsData] = useState(null);
  const [expandedForms, setExpandedForms] = useState({});
  const [expandedSections, setExpandedSections] = useState({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  // selectedSections: { "formID-secIdx": true/false }
  const [selectedSections, setSelectedSections] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [filters, setFilters] = useState({
    startDate: getDefaultStartDate(),
    endDate: getDefaultEndDate(),
  });

  useEffect(() => {
    loadAllSectionsData();
  }, []);

  const loadAllSectionsData = async () => {
    try {
      setLoading(true);
      const data = await consumptionService.getAllSectionsData(filters);
      if (data && typeof data === 'object') {
        const normalized = {
          totalForms: data.totalForms || 0,
          templateSummary: Array.isArray(data.templateSummary) ? data.templateSummary : (data.templateSummary?.$values || []),
          forms: Array.isArray(data.forms) ? data.forms : (data.forms?.$values || [])
        };
        // Normalizar sections dentro de cada form
        normalized.forms = normalized.forms.map(f => ({
          ...f,
          sections: (Array.isArray(f.sections) ? f.sections : (f.sections?.$values || [])).map(s => ({
            ...s,
            columns: Array.isArray(s.columns) ? s.columns : (s.columns?.$values || []),
            rows: (Array.isArray(s.rows) ? s.rows : (s.rows?.$values || [])).map(r => {
              // Normalizar cada fila si viene con $values
              if (r && typeof r === 'object' && !Array.isArray(r)) {
                const normalizedRow = {};
                Object.entries(r).forEach(([key, val]) => {
                  if (key !== '$id' && key !== '$values') {
                    normalizedRow[key] = val;
                  }
                });
                return normalizedRow;
              }
              return r;
            })
          }))
        }));
        setAllSectionsData(normalized);
      } else {
        setAllSectionsData({ totalForms: 0, templateSummary: [], forms: [] });
      }
    } catch (error) {
      console.error('Error al cargar todas las secciones:', error);
      setAllSectionsData({ totalForms: 0, templateSummary: [], forms: [] });
    } finally {
      setLoading(false);
    }
  };

  const toggleFormExpand = (formID) => {
    setExpandedForms(prev => ({ ...prev, [formID]: !prev[formID] }));
  };

  const toggleSectionExpand = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  // === Selección de secciones para exportar ===
  const toggleSectionSelect = (formID, secIdx, e) => {
    e.stopPropagation();
    const key = `${formID}-${secIdx}`;
    setSelectedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleFormSelect = (form, e) => {
    e.stopPropagation();
    const sections = form.sections || [];
    const allSelected = sections.every((_, idx) => selectedSections[`${form.formID}-${idx}`]);
    const newSelections = { ...selectedSections };
    sections.forEach((_, idx) => {
      newSelections[`${form.formID}-${idx}`] = !allSelected;
    });
    setSelectedSections(newSelections);
  };

  const selectAll = () => {
    const newSelections = {};
    (allSectionsData?.forms || []).forEach(form => {
      (form.sections || []).forEach((_, idx) => {
        newSelections[`${form.formID}-${idx}`] = true;
      });
    });
    setSelectedSections(newSelections);
  };

  const deselectAll = () => {
    setSelectedSections({});
  };

  const getSelectedCount = () => {
    return Object.values(selectedSections).filter(Boolean).length;
  };

  // Descarga un archivo sin usar data: URIs. Con 3.500+ filas el enlace
  // data:text/csv supera el límite del navegador (~2 MB) y el click no hacía
  // nada: por eso "no dejaba exportar".
  const descargarArchivo = (blob, nombre) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nombre;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const nombreArchivo = (ext) => {
    const rango = filters.startDate && filters.endDate
      ? `${filters.startDate}_al_${filters.endDate}`
      : (filters.startDate || filters.endDate || new Date().toISOString().slice(0, 10));
    return `Resumen_Consumos_Insumos_${rango}.${ext}`;
  };

  const fechaDe = (valor) => {
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const handleExportSelected = async () => {
    if (consolidatedInsumos.length === 0) {
      alert('⚠️ No hay datos para exportar en este resumen');
      return;
    }

    setExporting(true);
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Frigolab Docs';
      wb.created = new Date();

      // ── Hoja 1: detalle, igual que la tabla de la pantalla ──
      const ws = wb.addWorksheet('Resumen', { views: [{ state: 'frozen', ySplit: 4 }] });

      ws.mergeCells('A1:K1');
      const titulo = ws.getCell('A1');
      titulo.value = 'RESUMEN GENERAL DE INSUMOS Y MATERIALES';
      titulo.font = { bold: true, size: 14, color: { argb: 'FF024A73' } };
      titulo.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 24;

      ws.mergeCells('A2:K2');
      const subtitulo = ws.getCell('A2');
      subtitulo.value =
        `Desde ${filters.startDate || '—'} hasta ${filters.endDate || '—'}   ·   ` +
        `${consolidatedInsumos.length} registros   ·   Generado ${new Date().toLocaleString('es-EC')}`;
      subtitulo.font = { size: 10, color: { argb: 'FF6B7280' } };
      subtitulo.alignment = { horizontal: 'center' };

      ws.addRow([]);
      const headers = [
        '#', '# FORM', 'CÓDIGO DEL FORMULARIO', 'FECHA REGISTRADA', 'FORMULARIO',
        'DESTINO', 'CREADO POR', 'CÓDIGO', 'INSUMO', 'CANTIDAD', 'UNIDAD DE MEDIDA',
      ];
      const headerRow = ws.addRow(headers);
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF024A73' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });

      consolidatedInsumos.forEach((row, i) => {
        const fecha = fechaDe(row.createdAt);
        const fila = ws.addRow([
          i + 1,
          row.formID,
          row.templateCode,
          fecha || '',
          row.templateName,
          row.destino || '',
          row.filledBy || '',
          row.codigo || '',
          row.producto,
          Number(row.cantidad) || 0,
          row.unidad || '',
        ]);
        if (fecha) fila.getCell(4).numFmt = 'dd/mm/yyyy';
        fila.getCell(10).numFmt = '#,##0.00';
        fila.getCell(4).alignment = { horizontal: 'center' };
        fila.getCell(10).alignment = { horizontal: 'right' };
      });

      ws.columns = [
        { width: 6 }, { width: 8 }, { width: 20 }, { width: 14 }, { width: 42 },
        { width: 14 }, { width: 20 }, { width: 18 }, { width: 42 }, { width: 12 }, { width: 14 },
      ];
      ws.autoFilter = {
        from: { row: headerRow.number, column: 1 },
        to: { row: headerRow.number + consolidatedInsumos.length, column: 11 },
      };

      // ── Hoja 2: totales por insumo (lo que Costos suma a mano) ──
      const agrupado = new Map();
      consolidatedInsumos.forEach((row) => {
        const clave = `${row.codigo || ''}|${row.producto}|${row.unidad || ''}`.toLowerCase();
        if (!agrupado.has(clave)) {
          agrupado.set(clave, {
            codigo: row.codigo || '',
            insumo: row.producto,
            unidad: row.unidad || '',
            cantidad: 0,
            registros: 0,
          });
        }
        const item = agrupado.get(clave);
        item.cantidad += Number(row.cantidad) || 0;
        item.registros += 1;
      });

      const ws2 = wb.addWorksheet('Totales por insumo');
      ws2.mergeCells('A1:E1');
      const t2 = ws2.getCell('A1');
      t2.value = 'TOTALES POR INSUMO';
      t2.font = { bold: true, size: 14, color: { argb: 'FF024A73' } };
      t2.alignment = { horizontal: 'center' };
      ws2.addRow([]);
      const header2 = ws2.addRow(['CÓDIGO', 'INSUMO', 'UNIDAD DE MEDIDA', 'CANTIDAD TOTAL', 'REGISTROS']);
      header2.eachCell((cell) => {
        cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF024A73' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });

      [...agrupado.values()]
        .sort((a, b) => a.insumo.localeCompare(b.insumo, 'es'))
        .forEach((item) => {
          const fila = ws2.addRow([item.codigo, item.insumo, item.unidad, item.cantidad, item.registros]);
          fila.getCell(4).numFmt = '#,##0.00';
        });

      ws2.columns = [{ width: 20 }, { width: 48 }, { width: 16 }, { width: 16 }, { width: 12 }];
      ws2.views = [{ state: 'frozen', ySplit: 3 }];

      const buffer = await wb.xlsx.writeBuffer();
      descargarArchivo(
        new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        nombreArchivo('xlsx')
      );
    } catch (error) {
      console.error('Error al exportar a Excel:', error);
      alert('❌ Error al exportar a Excel: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportCsv = () => {
    if (consolidatedInsumos.length === 0) {
      alert('⚠️ No hay datos para exportar en este resumen');
      return;
    }

    setExporting(true);
    try {
      const escapar = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lineas = [
        ['#', '# FORM', 'CÓDIGO DEL FORMULARIO', 'FECHA REGISTRADA', 'FORMULARIO',
          'DESTINO', 'CREADO POR', 'CÓDIGO', 'INSUMO', 'CANTIDAD', 'UNIDAD DE MEDIDA']
          .map(escapar).join(','),
      ];
      consolidatedInsumos.forEach((row, i) => {
        const fecha = fechaDe(row.createdAt);
        lineas.push([
          i + 1,
          row.formID,
          row.templateCode,
          fecha ? fecha.toLocaleDateString('es-EC') : '',
          row.templateName,
          row.destino || '',
          row.filledBy || '',
          row.codigo || '',
          row.producto,
          Number(row.cantidad) || 0,
          row.unidad || '',
        ].map(escapar).join(','));
      });

      // BOM para que Excel abra bien las tildes.
      const blob = new Blob(['\uFEFF' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      descargarArchivo(blob, nombreArchivo('csv'));
    } catch (error) {
      console.error('Error al exportar CSV:', error);
      alert('❌ Error al exportar CSV: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const consolidatedInsumos = useMemo(() => {
    if (!allSectionsData || !allSectionsData.forms) return [];
    
    const rowsList = [];

    allSectionsData.forms.forEach(form => {
      (form.sections || []).forEach(section => {
        const title = (section.sectionTitle || '').toUpperCase();
        // Filtrar solo las tablas llamadas Insumos o Materiales de Empaque
        if (section.sectionType === 'table' && (title.includes('INSUMO') || title.includes('EMPAQUE') || title.includes('MATERIAL'))) {
          const cols = section.columns || [];
          const esColumnaCodigo = (c) => /C[OÓ]DIGO/i.test(c);
          const esColumnaProducto = (c) => /PRODUCTO|ITEM|DESCRIPCI[OÓ]N|ART[IÍ]CULO|INSUMO|MATERIAL/i.test(c);

          const cantColIdx = cols.findIndex(c => /CANTIDAD|USADO|CONSUMO|KILOS|LIBRAS/i.test(c) && !/MERMA/i.test(c));
          const unitColIdx = cols.findIndex(c => /UNIDAD|MEDIDA|U\.M/i.test(c));
          const codigoColIdx = cols.findIndex(c => esColumnaCodigo(c));

          // OJO: hay formularios cuya primera columna se llama "CÓDIGO INSUMO".
          // Si no se excluye, se tomaba como columna de producto y el Excel
          // mostraba el código (EM-CJA-061, EM-PLT-061...) en vez del material.
          let prodColIdx = cols.findIndex(c => esColumnaProducto(c) && !esColumnaCodigo(c));
          if (prodColIdx === -1) {
            // Último recurso: la primera columna que no sea código, cantidad ni unidad.
            prodColIdx = cols.findIndex((c, i) => i !== codigoColIdx && i !== cantColIdx && i !== unitColIdx);
          }

          if (prodColIdx === -1 && cantColIdx === -1) return;

          (section.rows || []).forEach(row => {
            const rowKeys = Object.keys(row);
            
            const getVal = (idx) => {
               if (idx === -1) return null;
               const colName = cols[idx];
               if (row[colName] !== undefined && row[colName] !== null) return row[colName];
               
               const matchKey = rowKeys.find(k => k.toLowerCase() === colName.toLowerCase() || k.toLowerCase().includes(colName.toLowerCase()) || colName.toLowerCase().includes(k.toLowerCase()));
               if (matchKey && row[matchKey] !== undefined) return row[matchKey];
               
               return row[rowKeys[idx]];
            };

            let prodName = getVal(prodColIdx) || 'Desconocido';
            let qtyStr = getVal(cantColIdx);
            let qty = parseFloat(qtyStr) || 0;
            let unit = getVal(unitColIdx) || '';
            let codigo = getVal(codigoColIdx) || '';

            // Red de seguridad: si quedó el código como nombre, buscar otra
            // columna que sí describa el material.
            if (codigo && String(prodName).trim() === String(codigo).trim()) {
              const altIdx = cols.findIndex(
                (c, i) => i !== codigoColIdx && i !== prodColIdx && esColumnaProducto(c) && !esColumnaCodigo(c)
              );
              if (altIdx !== -1) prodName = getVal(altIdx) || prodName;
            }

            if (!prodName || prodName === 'Desconocido' || prodName.toString().trim() === '') return;

            rowsList.push({
              formID: form.formID,
              templateCode: form.templateCode || 'N/A',
              templateName: form.templateName,
              // Destino del encabezado del formulario (Frigolab, San Mateo,
              // Ecuatun...). Viene del backend; vacio si el registro no lo trae.
              destino: form.destino || '',
              createdAt: form.createdAt,
              filledBy: form.filledBy || 'Desconocido',
              codigo,
              producto: prodName,
              cantidad: qty,
              unidad: unit,
            });
          });
        }
      });
    });

    // Ordenar por fecha de creación descendente
    return rowsList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [allSectionsData]);

  if (loading && !allSectionsData) {
    return (
      <div className="consumption-dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Cargando secciones de formularios...</p>
        </div>
      </div>
    );
  }

  const totalSections = (allSectionsData?.forms || []).reduce(
    (sum, f) => sum + (f.sections || []).length, 0
  );
  const totalRows = (allSectionsData?.forms || []).reduce(
    (sum, f) => sum + (f.sections || []).reduce((s2, sec) => s2 + (sec.rows || []).length, 0), 0
  );

  return (
    <div className="consumption-dashboard">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <h1>📋 Secciones de Formularios</h1>
          <p className="subtitle">Vista completa de todas las secciones y datos de los formularios</p>
        </div>
        <div className="header-actions">
          <button
            onClick={handleExportSelected}
            disabled={exporting || consolidatedInsumos.length === 0}
            className="btn-primary"
            style={{
              opacity: consolidatedInsumos.length === 0 ? 0.5 : 1,
              cursor: consolidatedInsumos.length === 0 ? 'not-allowed' : 'pointer',
            }}
            title="Descarga un .xlsx con el detalle y los totales por insumo"
          >
            {exporting ? '⏳ Exportando...' : `📥 Exportar a Excel`}
          </button>
          <button
            onClick={handleExportCsv}
            disabled={exporting || consolidatedInsumos.length === 0}
            className="btn-secondary"
            style={{
              opacity: consolidatedInsumos.length === 0 ? 0.5 : 1,
              cursor: consolidatedInsumos.length === 0 ? 'not-allowed' : 'pointer',
            }}
            title="Descarga el mismo resumen en CSV"
          >
            📄 CSV
          </button>
          <Link to="/" className="btn-secondary">
            ← Volver al Inicio
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div className="filters-section">
        <div className="filters-container">
          <div className="filter-group">
            <label className="filter-label">Fecha Inicio:</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label className="filter-label">Fecha Fin:</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="filter-input"
            />
          </div>
          <button onClick={loadAllSectionsData} className="btn-filter">
            🔍 Buscar
          </button>
        </div>
      </div>

      {/* Tarjetas resumen */}
      <div className="stats-grid">
        <div className="stat-card total">
          <div className="stat-icon">📝</div>
          <div className="stat-content">
            <h3>{allSectionsData?.totalForms || 0}</h3>
            <p>Formularios</p>
          </div>
        </div>
        <div className="stat-card consumption">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>{totalSections}</h3>
            <p>Secciones Totales</p>
          </div>
        </div>
        <div className="stat-card forms">
          <div className="stat-icon">📄</div>
          <div className="stat-content">
            <h3>{totalRows}</h3>
            <p>Filas de Datos</p>
          </div>
        </div>
        <div className="stat-card areas">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <h3>{(allSectionsData?.templateSummary || []).length}</h3>
            <p>Plantillas</p>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="view-content">
        {!allSectionsData || allSectionsData.totalForms === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No se encontraron secciones en formularios</h3>
            <p>No se detectaron datos en las secciones/tablas de los formularios del rango seleccionado</p>
          </div>
        ) : (
          <>
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>📦</span>
                <h2 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>Resumen General de Insumos y Materiales</h2>
                <span style={{ marginLeft: 'auto', background: '#dbeafe', color: '#1e40af', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                  {consolidatedInsumos.length} ítems
                </span>
              </div>
              <div style={{ overflowX: 'auto', padding: '0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#64748b' }}>#</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#64748b' }} title="Número de este registro">🔢 # FORM</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#64748b' }}>CÓDIGO DEL FORMULARIO</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#64748b' }}>FECHA REGISTRADA</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#64748b' }}>FORMULARIO</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#64748b' }} title="Destino declarado en el encabezado">DESTINO</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#64748b' }}>CREADO POR</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#64748b' }}>CÓDIGO</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#64748b' }}>INSUMO</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#64748b' }}>CANTIDAD</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#64748b' }}>UNIDAD DE MEDIDA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidatedInsumos.length === 0 ? (
                      <tr>
                        <td colSpan="11" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                          No se detectaron tablas de "Insumos" o "Materiales de Empaque" en los formularios de este rango de fechas.
                        </td>
                      </tr>
                    ) : (
                      consolidatedInsumos.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fafbfc' }}>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: '#94a3b8', fontWeight: '500' }}>{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                          <td style={{ padding: '10px 14px', color: '#0f172a', fontWeight: '700', fontFamily: 'monospace' }}>
                            # {item.formID}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontFamily: 'monospace' }}>
                            {item.templateCode}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#475569', fontWeight: '500' }}>
                            {new Date(item.createdAt).toLocaleDateString('es-ES')}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#1e40af', fontWeight: '600' }}>
                            {item.templateName}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#475569', fontWeight: '600' }}>{item.destino || '—'}</td>
                          <td style={{ padding: '10px 14px', color: '#64748b', fontWeight: '500' }}>{item.filledBy}</td>
                          <td style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontFamily: 'monospace' }}>{item.codigo || '-'}</td>
                          <td style={{ padding: '10px 14px', color: '#1e293b', fontWeight: '600' }}>{item.producto}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#166534', fontWeight: '700' }}>{formatNumber(item.cantidad)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: '#475569', fontWeight: '500' }}>{item.unidad || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {consolidatedInsumos.length > itemsPerPage && (
                <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <span style={{ fontSize: '14px', color: '#64748b' }}>
                    Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, consolidatedInsumos.length)} de {consolidatedInsumos.length}
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      style={{ padding: '6px 12px', border: '1px solid #cbd5e1', background: currentPage === 1 ? '#f1f5f9' : 'white', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: '#475569' }}
                    >
                      Anterior
                    </button>
                    <button 
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(consolidatedInsumos.length / itemsPerPage)))}
                      disabled={currentPage === Math.ceil(consolidatedInsumos.length / itemsPerPage)}
                      style={{ padding: '6px 12px', border: '1px solid #cbd5e1', background: currentPage === Math.ceil(consolidatedInsumos.length / itemsPerPage) ? '#f1f5f9' : 'white', borderRadius: '6px', cursor: currentPage === Math.ceil(consolidatedInsumos.length / itemsPerPage) ? 'not-allowed' : 'pointer', color: '#475569' }}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Funciones auxiliares
function getDefaultStartDate() {
  return ''; // Por defecto no filtrar por fecha de inicio para traer todos los registros
}

function getDefaultEndDate() {
  return ''; // Por defecto no filtrar por fecha de fin para traer todos
}

function formatNumber(num) {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}