"use client"

import { useState } from "react"
import { API_BASE_URL } from "../apiConfig"

const API_URL = `${API_BASE_URL}/Templates`

// ============================================================
// PLANTILLA 1: CONTROL DE BUENAS PRÁCTICAS DE MANUFACTURA (PERSONAL)
// Código: FOR-CC-1 | Versión: 2 | Fecha: 20/3/2025
// ============================================================
function getBPMTemplate() {
  const headerFields = [
    { label: "Fecha", type: "date", required: true, options: [], apiMap: "", apiEndpoint: "" },
    { label: "Hora / Preoperativo", type: "time", required: true, options: [], apiMap: "", apiEndpoint: "" },
  ]

  const bodyElements = [
    // ── SECCIÓN 1: Tabla de verificación BPM ──
    {
      id: Date.now(),
      type: "table",
      title: "Verificación BPM - Durante el ingreso del personal a las salas de proceso",
      defaultRows: 0,
      columns: [
        { label: "Categoría", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Criterio" },
        { label: "Criterio", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Criterio" },
        { label: "Cumple? (Sí o No)", type: "radio", required: true, options: ["Sí", "No"], apiMap: "", apiEndpoint: "", formula: "", group: "Verificación" },
        { label: "Observación", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Verificación" },
      ],
      predefinedRows: [
        // HIGIENE
        {
          "Categoría": "HIGIENE",
          "Criterio": "UÑAS CORTAS, LIMPIAS Y SIN ESMALTES",
          "Cumple? (Sí o No)": "",
          "Observación": "",
          _rowSpan: { "Categoría": 4 },
          _hidden: {}
        },
        {
          "Categoría": "HIGIENE",
          "Criterio": "CABELLO, BARBA, NARIZ Y BOCA CUBIERTOS CORRECTAMENTE",
          "Cumple? (Sí o No)": "",
          "Observación": "",
          _rowSpan: {},
          _hidden: { "Categoría": true }
        },
        {
          "Categoría": "HIGIENE",
          "Criterio": "AUSENCIA DE OLORES EXTRAÑOS (PERFUMES, LOCIÓN, ETC)",
          "Cumple? (Sí o No)": "",
          "Observación": "",
          _rowSpan: {},
          _hidden: { "Categoría": true }
        },
        {
          "Categoría": "HIGIENE",
          "Criterio": "LAVADO Y DESINFECCIÓN DE MANOS APLICANDO LA TÉCNICA CORRECTA",
          "Cumple? (Sí o No)": "",
          "Observación": "",
          _rowSpan: {},
          _hidden: { "Categoría": true }
        },
        // VESTIMENTA Y EPP
        {
          "Categoría": "VESTIMENTA Y EPP",
          "Criterio": "BATA / MANDIL LIMPIO Y EN BUEN ESTADO",
          "Cumple? (Sí o No)": "",
          "Observación": "",
          _rowSpan: { "Categoría": 3 },
          _hidden: {}
        },
        {
          "Categoría": "VESTIMENTA Y EPP",
          "Criterio": "ROPA SEGURA (SIN ACCESORIOS COLGANTES O MATERIALES DESPRENDIBLES EXPUESTOS)",
          "Cumple? (Sí o No)": "",
          "Observación": "",
          _rowSpan: {},
          _hidden: { "Categoría": true }
        },
        {
          "Categoría": "VESTIMENTA Y EPP",
          "Criterio": "ANTEOJOS EN BUEN ESTADO (LENTE/ARMAZÓN)",
          "Cumple? (Sí o No)": "",
          "Observación": "",
          _rowSpan: {},
          _hidden: { "Categoría": true }
        },
        // SALUD
        {
          "Categoría": "SALUD",
          "Criterio": "SIN PROBLEMAS DE SALUD",
          "Cumple? (Sí o No)": "",
          "Observación": "",
          _rowSpan: { "Categoría": 2 },
          _hidden: {}
        },
        {
          "Categoría": "SALUD",
          "Criterio": "SIN HERIDAS EXPUESTAS EN MANOS Y ANTEBRAZOS (CORTES/RASGUÑOS EN MANOS O ANTEBRAZO)",
          "Cumple? (Sí o No)": "",
          "Observación": "",
          _rowSpan: {},
          _hidden: { "Categoría": true }
        },
        // OBJETOS/ARTÍCULOS AUTORIZADOS
        {
          "Categoría": "OBJETOS/ARTÍCULOS AUTORIZADOS",
          "Criterio": "SIN JOYAS, RELOJES U OTROS OBJETOS NO PERMITIDOS EN ZONAS DE PRODUCCIÓN",
          "Cumple? (Sí o No)": "",
          "Observación": "",
          _rowSpan: { "Categoría": 3 },
          _hidden: {}
        },
        {
          "Categoría": "OBJETOS/ARTÍCULOS AUTORIZADOS",
          "Criterio": "EQUIPOS MOVILES AUTORIZADOS EN BUEN ESTADO (CELULARES, TABLET, RADIOS) / SOLO PERSONAL AUTORIZADO",
          "Cumple? (Sí o No)": "",
          "Observación": "",
          _rowSpan: {},
          _hidden: { "Categoría": true }
        },
        {
          "Categoría": "OBJETOS/ARTÍCULOS AUTORIZADOS",
          "Criterio": "BOLÍGRAFO APROBADO (UN SOLO CUERPO) / SOLO PERSONAL AUTORIZADO",
          "Cumple? (Sí o No)": "",
          "Observación": "",
          _rowSpan: {},
          _hidden: { "Categoría": true }
        },
      ],
    },

    // ── SECCIÓN 2: Hallazgos durante proceso ──
    {
      id: Date.now() + 1,
      type: "table",
      title: "Hallazgos Durante Proceso (Detalle del Incumplimiento)",
      defaultRows: 6,
      columns: [
        { label: "Hora", type: "time", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Registro" },
        { label: "Nombre", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Registro" },
        { label: "Incumplimiento a las BPM", type: "textarea", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Detalle" },
        { label: "Acción Correctiva", type: "textarea", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Detalle" },
      ],
    },

    // ── SECCIÓN 3: Observaciones ──
    {
      id: Date.now() + 2,
      type: "observaciones",
      title: "Observaciones Generales",
    },
  ]

  const firmas = [
    {
      puesto: "Analista de Aseg. de Calidad",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
    {
      puesto: "Aseguramiento de Calidad",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
  ]

  return {
    codigo: "FOR-CC-1",
    nombre: "Control de Buenas Prácticas de Manufactura (Personal)",
    version: "2",
    fechaVersion: "2025-03-20T00:00:00Z",
    supervisa: "Aseguramiento de Calidad",
    proceso: "Control de Calidad",
    cuandoSeUsa: "Durante el ingreso del personal a las salas de proceso",
    quienLoLlena: "Analista de Aseg. de Calidad",
    frecuencia: "Diaria",
    isMasterForm: false,
    autoSumColumns: false,
    usaApi: false,
    isDraft: false,
    isObsolete: false,
    headerFields: JSON.stringify(headerFields),
    bodyElements: JSON.stringify(bodyElements),
    firmas: JSON.stringify(firmas),
  }
}

// ============================================================
// PLANTILLA 2: CONTROL DE LA LIMPIEZA, ALERGENOS Y QUÍMICOS
// Versión: 5 | Fecha: 17/10/2025
// ============================================================
function getLimpiezaTemplate() {
  const headerFields = [
    { label: "Fecha", type: "date", required: true, options: [], apiMap: "", apiEndpoint: "" },
    { label: "Superficie (Localización)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "" },
  ]

  // === ZONA 1 - DIARIO ===
  const puntosMuestreoZona1 = [
    { punto: "Clasific. Marelec 1", prioridad: 1 },
    { punto: "Clasific. Marelec 2", prioridad: 1 },
    { punto: "Clasificadora c.", prioridad: 1 },
    { punto: "Aguja inyec.", prioridad: 1 },
    { punto: "Maq. Cortadoras", prioridad: 1 },
    { punto: "Maq. Limpsang", prioridad: 1 },
    { punto: "Base sacacue", prioridad: 1 },
    { punto: "VC999 #1", prioridad: 1 },
    { punto: "VC999 #2", prioridad: 1 },
    { punto: "Gavetas amarillas", prioridad: 1 },
    { punto: "Tablas de teflón grandes", prioridad: 1 },
    { punto: "Tablas de teflón pequeñas", prioridad: 1 },
    { punto: "Cesta Glaseo", prioridad: 1 },
    { punto: "Bandejas largas", prioridad: 2 },
    { punto: "Cesta de escurrido c.", prioridad: 2 },
    { punto: "Gavetas Celestes", prioridad: 2 },
    { punto: "Gavetas Azules", prioridad: 2 },
    { punto: "Guantes", prioridad: 2 },
    { punto: "Cuchillos grandes", prioridad: 2 },
    { punto: "Cuchillos pequeños", prioridad: 2 },
    { punto: "Cestas paneras", prioridad: 2 },
    { punto: "Cestas plasticas", prioridad: 2 },
    { punto: "Mesas", prioridad: 2 },
    { punto: "Tinas de Glaseo", prioridad: 2 },
    { punto: "Tinas plásticas", prioridad: 2 },
    { punto: "Bandejas de coches de congelado", prioridad: 2 },
    { punto: "Balanzas", prioridad: 2 },
    { punto: "Bascula fija", prioridad: 2 },
    { punto: "Lavaderos metálic.", prioridad: 2 },
    { punto: "Palas", prioridad: 2 },
    { punto: "Cortinas", prioridad: 2 },
    { punto: "Máquina UltraVac", prioridad: 3 },
    { punto: "Gavetas Verdes", prioridad: 3 },
    { punto: "Gavetas Anaranjadas", prioridad: 3 },
    { punto: "Coches de congelado", prioridad: 3 },
    { punto: "Gavetas Grises", prioridad: 3 },
    { punto: "Gavetas negras", prioridad: 3 },
    { punto: "Lavamanos", prioridad: 3 },
    { punto: "Carros para gavetas", prioridad: 3 },
    { punto: "Manguillos plásticos", prioridad: 3 },
  ]

  // === ZONA 2 - BISEMANAL (prioridad "-") ===
  const puntosMuestreoZona2 = [
    { punto: "Base plataforma azul", prioridad: "-" },
    { punto: "Tiras de subproducto", prioridad: "-" },
    { punto: "Pisos", prioridad: "-" },
    { punto: "Vestidor de visitantes", prioridad: "-" },
    { punto: "Soporte de maquina", prioridad: "-" },
    { punto: "Paredes", prioridad: "-" },
    { punto: "Montacargas Manuales", prioridad: "-" },
    { punto: "Rejillas de drenaje", prioridad: "-" },
    { punto: "Canal de drenaje", prioridad: "-" },
    { punto: "Techos", prioridad: "-" },
  ]

  const allPredefinedRows = []

  // Zona 1
  puntosMuestreoZona1.forEach((item, idx) => {
    allPredefinedRows.push({
      "Zona": "1",
      "Punto de Muestreo": item.punto,
      "Prioridad de Muestreo": String(item.prioridad),
      "Desengrasado / Jabón": "",
      "Cepillado": "",
      "Tempo de Acción": "",
      "Enjuagado": "",
      "Escurrido": "",
      "Desinfección / Frecuencia": "",
      "Visual (Cumple Apariencia)": "",
      "Brillo y Acero": "",
      "Resultado Bueno y Aceptable": "",
      "ATP": "",
      "Hisopado de Alergénicos": "",
      _rowSpan: idx === 0 ? { "Zona": puntosMuestreoZona1.length } : {},
      _hidden: idx > 0 ? { "Zona": true } : {},
    })
  })

  // Zona 2 - BISEMANAL
  puntosMuestreoZona2.forEach((item, idx) => {
    allPredefinedRows.push({
      "Zona": "2",
      "Punto de Muestreo": item.punto,
      "Prioridad de Muestreo": String(item.prioridad),
      "Desengrasado / Jabón": "",
      "Cepillado": "",
      "Tempo de Acción": "",
      "Enjuagado": "",
      "Escurrido": "",
      "Desinfección / Frecuencia": "",
      "Visual (Cumple Apariencia)": "",
      "Brillo y Acero": "",
      "Resultado Bueno y Aceptable": "",
      "ATP": "",
      "Hisopado de Alergénicos": "",
      _rowSpan: idx === 0 ? { "Zona": puntosMuestreoZona2.length } : {},
      _hidden: idx > 0 ? { "Zona": true } : {},
    })
  })

  const bodyElements = [
    // ── TABLA PRINCIPAL: Verificación de Limpieza ──
    {
      id: Date.now() + 10,
      type: "table",
      title: "Verificación de la Limpieza",
      defaultRows: 0,
      columns: [
        { label: "Zona", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Identificación" },
        { label: "Punto de Muestreo", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Identificación" },
        { label: "Prioridad de Muestreo", type: "select", required: false, options: ["1", "2", "3", "-"], apiMap: "", apiEndpoint: "", formula: "", group: "Identificación" },
        { label: "Desengrasado / Jabón", type: "radio", required: false, options: ["Sí", "No"], apiMap: "", apiEndpoint: "", formula: "", group: "Proceso de Limpieza" },
        { label: "Cepillado", type: "radio", required: false, options: ["Sí", "No"], apiMap: "", apiEndpoint: "", formula: "", group: "Proceso de Limpieza" },
        { label: "Tempo de Acción", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Proceso de Limpieza" },
        { label: "Enjuagado", type: "radio", required: false, options: ["Sí", "No"], apiMap: "", apiEndpoint: "", formula: "", group: "Proceso de Limpieza" },
        { label: "Escurrido", type: "radio", required: false, options: ["Sí", "No"], apiMap: "", apiEndpoint: "", formula: "", group: "Proceso de Limpieza" },
        { label: "Desinfección / Frecuencia", type: "radio", required: false, options: ["Sí", "No"], apiMap: "", apiEndpoint: "", formula: "", group: "Proceso de Limpieza" },
        { label: "Visual (Cumple Apariencia)", type: "radio", required: false, options: ["Sí", "No"], apiMap: "", apiEndpoint: "", formula: "", group: "Verificación de la Limpieza" },
        { label: "Brillo y Acero", type: "radio", required: false, options: ["Sí", "No"], apiMap: "", apiEndpoint: "", formula: "", group: "Verificación de la Limpieza" },
        { label: "Resultado Bueno y Aceptable", type: "radio", required: false, options: ["Sí", "No"], apiMap: "", apiEndpoint: "", formula: "", group: "Verificación de la Limpieza" },
        { label: "ATP", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Método" },
        { label: "Hisopado de Alergénicos", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Método" },
      ],
      predefinedRows: allPredefinedRows,
    },

    // ── SECCIÓN: Finalización de Limpieza ──
    {
      id: Date.now() + 11,
      type: "section",
      title: "Finalización de Limpieza",
      fields: [
        { label: "Finaliza Limpieza (Hora)", type: "time", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },

    // ── SECCIÓN: Manejo de Productos Químicos de Limpieza y Desinfección ──
    {
      id: Date.now() + 12,
      type: "section",
      title: "Manejo de Productos Químicos de Limpieza y Desinfección",
      fields: [
        { label: "¿Aprobados / Identificación Visible?", type: "radio", required: false, options: ["Sí", "No"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "¿Utilización Segura por Personal Autorizado?", type: "radio", required: false, options: ["Sí", "No"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "¿Dilución Correcta?", type: "radio", required: false, options: ["Sí", "No"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "¿Almacenamiento Adecuado (Exclusivo para Químicos)?", type: "radio", required: false, options: ["Sí", "No"], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },

    // ── SECCIÓN: Control de Ingreso de Equipos Móviles ──
    {
      id: Date.now() + 13,
      type: "table",
      title: "Control de Ingreso de Equipos Móviles",
      defaultRows: 4,
      columns: [
        { label: "Equipo que Ingresa", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Equipo" },
        { label: "Cantidad", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Equipo" },
        { label: "Limpiado y Desinfectado Por", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Limpieza y Desinfección del Equipo" },
        { label: "Desinfección Con", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Limpieza y Desinfección del Equipo" },
        { label: "A (ppm)", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Limpieza y Desinfección del Equipo" },
        { label: "Verificado Por", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Verificación" },
      ],
      predefinedRows: [
        {
          "Equipo que Ingresa": "ESCALERAS",
          "Cantidad": "",
          "Limpiado y Desinfectado Por": "",
          "Desinfección Con": "",
          "A (ppm)": "",
          "Verificado Por": "",
          _rowSpan: {},
          _hidden: {},
        },
        {
          "Equipo que Ingresa": "ELEVADORES MANUALES DE HORQUILLAS",
          "Cantidad": "",
          "Limpiado y Desinfectado Por": "",
          "Desinfección Con": "",
          "A (ppm)": "",
          "Verificado Por": "",
          _rowSpan: {},
          _hidden: {},
        },
        {
          "Equipo que Ingresa": "OTRO (especifique):",
          "Cantidad": "",
          "Limpiado y Desinfectado Por": "",
          "Desinfección Con": "",
          "A (ppm)": "",
          "Verificado Por": "",
          _rowSpan: {},
          _hidden: {},
        },
      ],
    },

    // ── SECCIÓN: Soluciones de Limpieza y Desinfección ──
    {
      id: Date.now() + 14,
      type: "section",
      title: "Soluciones de Limpieza y Desinfección",
      fields: [
        { label: "Solución Jabonosa Preparada en Tinas (por Tina)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Tinas Disponibles (Jabonosa)", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Detalle Jabonosa (ej: 250 lts AGUA + 6 lts J. CLORADO + 6 lts J. DESENGR)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Solución para Desinfección de Superficies (por Tina)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Tinas Disponibles (Desinfección)", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Detalle Desinfección (ej: 400 lts AGUA + 426.67 ml Peroxac (15%) = 160 ppm)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },

    // ── SECCIÓN: Verificaciones Finales de Limpieza ──
    {
      id: Date.now() + 15,
      type: "section",
      title: "Verificaciones Finales",
      fields: [
        { label: "¿Se realizó verificación final de las áreas limpiadas/sanitizadas?", type: "radio", required: false, options: ["Sí", "No"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "¿Se usaron los utensilios apropiados para la limpieza?", type: "radio", required: false, options: ["Sí", "No"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "¿Los utensilios de limpieza fueron devueltos en buen estado y sanitizados?", type: "radio", required: false, options: ["Sí", "No"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "¿Fue aplicado el tratamiento de calor con vapor a los equipos acorde al plan?", type: "radio", required: false, options: ["Sí", "No"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "¿Se verificó la limpieza de las oficinas de las áreas productivas? (Recepción MP, Calidad, Etiquetas, Producción)", type: "radio", required: false, options: ["Sí", "No"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "¿Se limpió el equipo de cortina de aire acorde al plan?", type: "radio", required: false, options: ["Sí", "No"], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },

    // ── SECCIÓN: Observaciones ──
    {
      id: Date.now() + 16,
      type: "observaciones",
      title: "Observaciones",
    },

    // ── SECCIÓN: Acciones Correctivas ──
    {
      id: Date.now() + 17,
      type: "section",
      title: "Acciones Correctivas",
      fields: [
        { label: "Acciones Correctivas", type: "textarea", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },
  ]

  const firmas = [
    {
      puesto: "Supervisor de la Limpieza",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
    {
      puesto: "Responsable del Hisopado",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
    {
      puesto: "Aseguramiento de Calidad",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
  ]

  return {
    codigo: "FOR-CC-3",
    nombre: "Control de la Limpieza, Alergenos y Químicos",
    version: "5",
    fechaVersion: "2025-10-17T00:00:00Z",
    supervisa: "Aseguramiento de Calidad",
    proceso: "Limpieza y Desinfección",
    cuandoSeUsa: "Antes de iniciar las operaciones, post-limpieza",
    quienLoLlena: "Supervisor de Limpieza / Analista de Calidad",
    frecuencia: "Diaria",
    isMasterForm: false,
    autoSumColumns: false,
    usaApi: false,
    isDraft: false,
    isObsolete: false,
    headerFields: JSON.stringify(headerFields),
    bodyElements: JSON.stringify(bodyElements),
    firmas: JSON.stringify(firmas),
  }
}

// ============================================================
// PLANTILLA: FOR-CC-13 - CONTROL DE CLASIFICACIÓN, PESO Y DIMENSIONES
// Versión: 1 | Fecha: 10/2/2025
// ============================================================
function getClasificacionPesoTemplate() {
  const headerFields = [
    { label: "Fecha", type: "date", required: true, options: [], apiMap: "", apiEndpoint: "" },
    { label: "Especie", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "" },
    { label: "Lote", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "" },
    { label: "Nombre de Cortadores", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "" },
  ]

  const monitoreoColumns = [
    { label: "T°C", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Datos" },
    { label: "CLASIF. oz", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Monitoreo Pesos" },
    { label: "PESO NETO oz", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Monitoreo Pesos" },
    { label: "OK (✓) / FALLA (X)", type: "select", required: false, options: ["✓", "X"], apiMap: "", apiEndpoint: "", formula: "", group: "Monitoreo Pesos" },
    { label: "LARGO Pulg.", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Monitoreo Medida" },
    { label: "ANCHO Pulg. Min.", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Monitoreo Medida" },
    { label: "HEMAT. [SI / NO]", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "", group: "Defectos" },
    { label: "MAT. EXTR. [SI / NO]", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "", group: "Defectos" },
  ]

  const bodyElements = [
    // ── PANEL 1 ──
    {
      id: Date.now() + 100,
      type: "section",
      title: "Panel 1 - Datos de Clasificadora",
      fields: [
        { label: "Hora (Panel 1)", type: "time", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "MAQ. CLASIFICADORA # (Panel 1)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "CLIENTE (Panel 1)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "MANUAL (Panel 1)", type: "radio", required: false, options: ["Sí", "No"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "BALANZA # (Panel 1)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },
    {
      id: Date.now() + 101,
      type: "table",
      title: "Monitoreo Panel 1",
      defaultRows: 13,
      columns: monitoreoColumns,
    },

    // ── PANEL 2 ──
    {
      id: Date.now() + 102,
      type: "section",
      title: "Panel 2 - Datos de Clasificadora",
      fields: [
        { label: "Hora (Panel 2)", type: "time", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "MAQ. CLASIFICADORA # (Panel 2)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "CLIENTE (Panel 2)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "MANUAL (Panel 2)", type: "radio", required: false, options: ["Sí", "No"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "BALANZA # (Panel 2)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },
    {
      id: Date.now() + 103,
      type: "table",
      title: "Monitoreo Panel 2",
      defaultRows: 13,
      columns: monitoreoColumns,
    },

    // ── PANEL 3 ──
    {
      id: Date.now() + 104,
      type: "section",
      title: "Panel 3 - Datos de Clasificadora",
      fields: [
        { label: "Hora (Panel 3)", type: "time", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "MAQ. CLASIFICADORA # (Panel 3)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "CLIENTE (Panel 3)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "MANUAL (Panel 3)", type: "radio", required: false, options: ["Sí", "No"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "BALANZA # (Panel 3)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },
    {
      id: Date.now() + 105,
      type: "table",
      title: "Monitoreo Panel 3",
      defaultRows: 13,
      columns: monitoreoColumns,
    },

    // ── PANEL 4 ──
    {
      id: Date.now() + 106,
      type: "section",
      title: "Panel 4 - Datos de Clasificadora",
      fields: [
        { label: "Hora (Panel 4)", type: "time", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "MAQ. CLASIFICADORA # (Panel 4)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "CLIENTE (Panel 4)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "MANUAL (Panel 4)", type: "radio", required: false, options: ["Sí", "No"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "BALANZA # (Panel 4)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },
    {
      id: Date.now() + 107,
      type: "table",
      title: "Monitoreo Panel 4",
      defaultRows: 13,
      columns: monitoreoColumns,
    },

    // ── Verificación Balanzas ──
    {
      id: Date.now() + 108,
      type: "section",
      title: "Verificación de Balanzas con Peso Patrón",
      fields: [
        { label: "Balanzas verificadas con peso patrón", type: "radio", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },

    // ── Clasificaciones oz-gr ──
    {
      id: Date.now() + 109,
      type: "table",
      title: "Clasificaciones oz - gr (Desde-hasta)",
      defaultRows: 2,
      columns: [
        { label: "Clasificación 1", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Clasificaciones" },
        { label: "Clasificación 2", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Clasificaciones" },
        { label: "Clasificación 3", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Clasificaciones" },
        { label: "Clasificación 4", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Clasificaciones" },
        { label: "Clasificación 5", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Clasificaciones" },
        { label: "Clasificación 6", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Clasificaciones" },
        { label: "Clasificación 7", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Clasificaciones" },
        { label: "Clasificación 8", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Clasificaciones" },
      ],
    },

    // ── Programación Máquina ──
    {
      id: Date.now() + 110,
      type: "section",
      title: "Programación de la Máquina Clasificadora",
      fields: [
        { label: "% de Glaseo programado en Máquina Clasificadora", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },

    // ── Observaciones ──
    {
      id: Date.now() + 111,
      type: "observaciones",
      title: "Observaciones",
    },

    // ── Acciones Correctivas ──
    {
      id: Date.now() + 112,
      type: "section",
      title: "Acciones Correctivas",
      fields: [
        { label: "Acciones Correctivas", type: "textarea", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },
  ]

  const firmas = [
    {
      puesto: "Analista de Aseg. De Calidad",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
    {
      puesto: "Aseguramiento de Calidad",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
  ]

  return {
    codigo: "FOR-CC-13",
    nombre: "Control de Clasificación, Peso y Dimensiones de Porciones durante el Corte",
    version: "1",
    fechaVersion: "2025-02-10T00:00:00Z",
    supervisa: "Aseguramiento de Calidad",
    proceso: "Control de Calidad - Corte y Clasificación",
    cuandoSeUsa: "Durante el proceso de corte y clasificación de porciones",
    quienLoLlena: "Analista de Aseg. De Calidad",
    frecuencia: "Por turno",
    isMasterForm: false,
    autoSumColumns: false,
    usaApi: false,
    isDraft: false,
    isObsolete: false,
    headerFields: JSON.stringify(headerFields),
    bodyElements: JSON.stringify(bodyElements),
    firmas: JSON.stringify(firmas),
  }
}

// ============================================================
// PLANTILLA: FOR-CC-14 - CONTROL DE GLASEO INICIAL
// Versión: 1 | Fecha: 10/2/2025
// ============================================================
function getGlaseoInicialTemplate() {
  const headerFields = [
    { label: "Fecha", type: "date", required: true, options: [], apiMap: "", apiEndpoint: "" },
  ]

  const glaseoColumns = [
    { label: "CLASIF.", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Determinación % Glaseo" },
    { label: "PESO lbs S/GLASEO", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Determinación % Glaseo" },
    { label: "PESO lbs C/GLASEO", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Determinación % Glaseo" },
    { label: "%", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Determinación % Glaseo" },
    { label: "% PROM. POR CLASIF.", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Determinación % Glaseo" },
  ]

  const panelHeaderFields = (n) => [
    { label: `Hora (Túnel ${n})`, type: "time", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
    { label: `Túnel (Túnel ${n})`, type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
    { label: `Producto / Presentación (Túnel ${n})`, type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
    { label: `Lote (Túnel ${n})`, type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
    { label: `T°C PROM. PROD. (Túnel ${n})`, type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
    { label: `T°C AGUA (Túnel ${n})`, type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
  ]

  const bodyElements = []
  for (let i = 1; i <= 6; i++) {
    bodyElements.push({
      id: Date.now() + 200 + (i * 2 - 2),
      type: "section",
      title: `Túnel ${i} - Datos de Liberación`,
      fields: panelHeaderFields(i),
    })
    bodyElements.push({
      id: Date.now() + 200 + (i * 2 - 1),
      type: "table",
      title: `Determinación del % de Glaseo - Túnel ${i}`,
      defaultRows: 13,
      columns: glaseoColumns,
    })
  }

  bodyElements.push({
    id: Date.now() + 220,
    type: "observaciones",
    title: "Observaciones",
  })
  bodyElements.push({
    id: Date.now() + 221,
    type: "section",
    title: "Acciones Correctivas",
    fields: [
      { label: "Acciones Correctivas", type: "textarea", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
    ],
  })

  const firmas = [
    {
      puesto: "Analista de Aseg. De Calidad",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
    {
      puesto: "Aseguramiento de Calidad",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
  ]

  return {
    codigo: "FOR-CC-14",
    nombre: "Control de Glaseo Inicial de Productos Congelados (Liberación de Túneles)",
    version: "1",
    fechaVersion: "2025-02-10T00:00:00Z",
    supervisa: "Aseguramiento de Calidad",
    proceso: "Control de Calidad - Glaseo",
    cuandoSeUsa: "Durante la liberación de túneles de congelado",
    quienLoLlena: "Analista de Aseg. De Calidad",
    frecuencia: "Por lote / liberación de túnel",
    isMasterForm: false,
    autoSumColumns: false,
    usaApi: false,
    isDraft: false,
    isObsolete: false,
    headerFields: JSON.stringify(headerFields),
    bodyElements: JSON.stringify(bodyElements),
    firmas: JSON.stringify(firmas),
  }
}

// ============================================================
// PLANTILLA: FOR-CC-15 - CONTROL DE GLASEO FINAL
// Versión: 1 | Fecha: 10/2/2025
// ============================================================
function getGlaseoFinalTemplate() {
  const headerFields = [
    { label: "Fecha", type: "date", required: true, options: [], apiMap: "", apiEndpoint: "" },
  ]

  const bodyElements = [
    // ── SECCIÓN 1: Verificación Glaseo Inicial para calibrar ──
    {
      id: Date.now() + 300,
      type: "table",
      title: "Verificación de % de Glaseo Inicial en Porciones para Calibrar Maquina Clasificadora",
      defaultRows: 6,
      columns: [
        { label: "HORA", type: "time", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Identificación" },
        { label: "LOTE", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Identificación" },
        { label: "# CÁM.", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Identificación" },
        { label: "PRODUCTO / PRESENTACIÓN", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Identificación" },
        { label: "CLASIF.", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Identificación" },
        { label: "T°C AGUA", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Temperatura" },
        { label: "T°C PROD.", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Temperatura" },
        { label: "GLASEO EN TIRAS", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Glaseo" },
        { label: "PESO lbs C/GLASEO", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "% Glaseo Maq. Clasif." },
        { label: "PESO lbs S/GLASEO", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "% Glaseo Maq. Clasif." },
        { label: "%", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "% Glaseo Maq. Clasif." },
      ],
    },

    // ── GLASEO FINAL - Panel Izquierdo ──
    {
      id: Date.now() + 301,
      type: "section",
      title: "Glaseo Final - Comprobación (Panel Izquierdo)",
      fields: [
        { label: "Hora (Panel Izq.)", type: "time", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Producto / Presentación (Panel Izq.)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Lote (Panel Izq.)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "T°C AGUA (Panel Izq.)", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "T°C PROM. PROD. (Panel Izq.)", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },
    {
      id: Date.now() + 302,
      type: "table",
      title: "Glaseo Final - Datos Panel Izquierdo",
      defaultRows: 15,
      columns: [
        { label: "CLASIF.", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Glaseo Final" },
        { label: "PESO lbs C/GLASEO", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Glaseo Final" },
        { label: "PESO lbs S/GLASEO", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Glaseo Final" },
        { label: "%", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Glaseo Final" },
        { label: "% PROM. X CLASIF.", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Glaseo Final" },
      ],
    },

    // ── GLASEO FINAL - Panel Derecho ──
    {
      id: Date.now() + 303,
      type: "section",
      title: "Glaseo Final - Comprobación (Panel Derecho)",
      fields: [
        { label: "Hora (Panel Der.)", type: "time", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Producto / Presentación (Panel Der.)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Lote (Panel Der.)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "T°C AGUA (Panel Der.)", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "T°C PROM. PROD. (Panel Der.)", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },
    {
      id: Date.now() + 304,
      type: "table",
      title: "Glaseo Final - Datos Panel Derecho",
      defaultRows: 15,
      columns: [
        { label: "CLASIF.", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Glaseo Final" },
        { label: "PESO lbs C/GLASEO", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Glaseo Final" },
        { label: "PESO lbs S/GLASEO", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Glaseo Final" },
        { label: "%", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Glaseo Final" },
        { label: "% PROM. X CLASIF.", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Glaseo Final" },
      ],
    },

    // ── Material de Empaque ──
    {
      id: Date.now() + 305,
      type: "table",
      title: "Material de Empaque en Proceso",
      defaultRows: 3,
      columns: [
        { label: "MATERIAL", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Empaque" },
        { label: "LOTE", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Empaque" },
        { label: "SE UTILIZÓ EN:", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Empaque" },
      ],
    },

    // ── Observaciones ──
    {
      id: Date.now() + 306,
      type: "observaciones",
      title: "Observaciones",
    },

    // ── Acciones Correctivas ──
    {
      id: Date.now() + 307,
      type: "section",
      title: "Acciones Correctivas",
      fields: [
        { label: "Acciones Correctivas", type: "textarea", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },
  ]

  const firmas = [
    {
      puesto: "Analista de Aseg. De Calidad",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
    {
      puesto: "Aseguramiento de Calidad",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
  ]

  return {
    codigo: "FOR-CC-15",
    nombre: "Control de Glaseo Final de Productos Congelados (Corte y Clasificación)",
    version: "1",
    fechaVersion: "2025-02-10T00:00:00Z",
    supervisa: "Aseguramiento de Calidad",
    proceso: "Control de Calidad - Glaseo Final",
    cuandoSeUsa: "Durante la comprobación del % de glaseo final en productos congelados",
    quienLoLlena: "Analista de Aseg. De Calidad",
    frecuencia: "Por lote",
    isMasterForm: false,
    autoSumColumns: false,
    usaApi: false,
    isDraft: false,
    isObsolete: false,
    headerFields: JSON.stringify(headerFields),
    bodyElements: JSON.stringify(bodyElements),
    firmas: JSON.stringify(firmas),
  }
}

// ============================================================
// COMPONENTE DE PÁGINA
// ============================================================
function SeedBPMTemplates() {
  const [status, setStatus] = useState({})
  const [loading, setLoading] = useState({})

  const templates = [
    {
      key: "bpm",
      label: "Control de Buenas Prácticas de Manufactura (Personal)",
      code: "FOR-CC-1",
      getData: getBPMTemplate,
      icon: "🧤",
    },
    {
      key: "limpieza",
      label: "Control de la Limpieza, Alergenos y Químicos",
      code: "FOR-CC-3",
      getData: getLimpiezaTemplate,
      icon: "🧹",
    },
    {
      key: "clasificacion-peso",
      label: "Control de Clasificación, Peso y Dimensiones de Porciones durante el Corte",
      code: "FOR-CC-13",
      getData: getClasificacionPesoTemplate,
      icon: "⚖️",
    },
    {
      key: "glaseo-inicial",
      label: "Control de Glaseo Inicial de Productos Congelados (Liberación de Túneles)",
      code: "FOR-CC-14",
      getData: getGlaseoInicialTemplate,
      icon: "🧊",
    },
    {
      key: "glaseo-final",
      label: "Control de Glaseo Final de Productos Congelados (Corte y Clasificación)",
      code: "FOR-CC-15",
      getData: getGlaseoFinalTemplate,
      icon: "🐟",
    },
  ]

  const createTemplate = async (templateDef) => {
    setLoading((prev) => ({ ...prev, [templateDef.key]: true }))
    setStatus((prev) => ({ ...prev, [templateDef.key]: null }))

    try {
      const payload = templateDef.getData()

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Error ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      setStatus((prev) => ({
        ...prev,
        [templateDef.key]: { success: true, message: `Plantilla creada exitosamente (ID: ${result.templateID || result.id || "OK"})` },
      }))
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        [templateDef.key]: { success: false, message: error.message },
      }))
    } finally {
      setLoading((prev) => ({ ...prev, [templateDef.key]: false }))
    }
  }

  const createAll = async () => {
    for (const t of templates) {
      await createTemplate(t)
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: "#035b8d" }}>
        📋 Crear Plantillas de Control de Calidad
      </h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Estas plantillas corresponden a los formularios de Frigolab &quot;San Mateo&quot; para el área de Aseguramiento de Calidad.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <button
          onClick={createAll}
          disabled={Object.values(loading).some(Boolean)}
          style={{
            background: "#035b8d",
            color: "white",
            border: "none",
            borderRadius: 8,
            padding: "12px 24px",
            fontSize: 16,
            fontWeight: 600,
            cursor: "pointer",
            opacity: Object.values(loading).some(Boolean) ? 0.6 : 1,
          }}
        >
          🚀 Crear Todas las Plantillas
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {templates.map((t) => (
          <div
            key={t.key}
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: 12,
              padding: 20,
              background: status[t.key]?.success
                ? "#f0fdf4"
                : status[t.key]?.success === false
                  ? "#fef2f2"
                  : "#fff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                  {t.icon} {t.label}
                </h3>
                <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>
                  Código: <strong>{t.code}</strong>
                </p>
              </div>
              <button
                onClick={() => createTemplate(t)}
                disabled={loading[t.key]}
                style={{
                  background: "#16a34a",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: loading[t.key] ? 0.6 : 1,
                }}
              >
                {loading[t.key] ? "⏳ Creando..." : "➕ Crear"}
              </button>
            </div>

            {status[t.key] && (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  borderRadius: 6,
                  fontSize: 14,
                  background: status[t.key].success ? "#dcfce7" : "#fee2e2",
                  color: status[t.key].success ? "#166534" : "#991b1b",
                }}
              >
                {status[t.key].success ? "✅" : "❌"} {status[t.key].message}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Vista previa de estructura */}
      <details style={{ marginTop: 32 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, color: "#035b8d" }}>
          👁️ Ver estructura JSON de las plantillas
        </summary>
        <div style={{ marginTop: 12 }}>
          {templates.map((t) => (
            <details key={t.key} style={{ marginBottom: 12 }}>
              <summary style={{ cursor: "pointer", fontWeight: 500 }}>
                {t.icon} {t.code} - {t.label}
              </summary>
              <pre
                style={{
                  background: "#f5f5f5",
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 12,
                  overflow: "auto",
                  maxHeight: 400,
                }}
              >
                {JSON.stringify(t.getData(), null, 2)}
              </pre>
            </details>
          ))}
        </div>
      </details>
    </div>
  )
}

export default SeedBPMTemplates
