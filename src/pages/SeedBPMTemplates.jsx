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
    supervisa: "Proceso - Productivo",
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
    supervisa: "Proceso - Productivo",
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
    supervisa: "Proceso - Productivo",
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
    { label: "%", type: "formula", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "(([PESO lbs C/GLASEO] - [PESO lbs S/GLASEO]) / [PESO lbs C/GLASEO]) * 100", group: "Determinación % Glaseo" },
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
    supervisa: "Proceso - Productivo",
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
        { label: "%", type: "formula", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "(([PESO lbs C/GLASEO] - [PESO lbs S/GLASEO]) / [PESO lbs C/GLASEO]) * 100", group: "% Glaseo Maq. Clasif." },
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
        { label: "%", type: "formula", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "(([PESO lbs C/GLASEO] - [PESO lbs S/GLASEO]) / [PESO lbs C/GLASEO]) * 100", group: "Glaseo Final" },
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
        { label: "%", type: "formula", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "(([PESO lbs C/GLASEO] - [PESO lbs S/GLASEO]) / [PESO lbs C/GLASEO]) * 100", group: "Glaseo Final" },
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
    supervisa: "Proceso - Productivo",
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
// PLANTILLA: FOR-CC-16 - REGISTRO CALIBRACIÓN Y DESAFÍO DEL DETECTOR DE METAL (PCC)
// Versión: 1 | Fecha: 18/2/2025
// ============================================================
function getDetectorMetalTemplate() {
  const headerFields = [
    { label: "Fecha", type: "date", required: true, options: [], apiMap: "", apiEndpoint: "" },
    { label: "Máquina #", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "" },
    { label: "Producto / Presentación", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "" },
    { label: "Cliente", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "" },
    { label: "Tipo Empaque - CAJA", type: "radio", required: false, options: ["Sí", "No"], apiMap: "", apiEndpoint: "" },
    { label: "Tipo Empaque - FUNDA", type: "radio", required: false, options: ["Sí", "No"], apiMap: "", apiEndpoint: "" },
  ]

  const bodyElements = [
    // ── Pre Operativo ──
    {
      id: Date.now() + 400,
      type: "section",
      title: "PRE OPERATIVO - Desafío de la máquina detectora de metales",
      fields: [
        { label: "Pre Operativo - Hora", type: "time", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "2.5 mm Fe - SI", type: "radio", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "3.0 mm Fe - SI", type: "radio", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "3.0 mm Non Fe - SI", type: "radio", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "4.0 mm SS - SI", type: "radio", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "¿Se desafió pasando una curita para cortes? Lote curita", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Curita - Resultado", type: "radio", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },

    // ── Tabla Principal de Monitoreo ──
    {
      id: Date.now() + 401,
      type: "table",
      title: "Registro de Detección de Metales Durante Producción",
      defaultRows: 10,
      columns: [
        { label: "HORA", type: "time", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Producto" },
        { label: "LOTE", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Producto" },
        { label: "Clasificación", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Producto" },
        { label: "Todos los productos pasaron a través del detector de metal plenamente funcionando", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "", group: "Detector" },
        { label: "Algún fragmento de metal es detectado en el producto que pasó a través del detector de metales", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "", group: "Detector" },
        { label: "Desafío c/hora con esferas: 2.5mm Fe, 3mm Fe, 3mm NoFe, 4mm SS - ¿Exitoso?", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "", group: "Desafío" },
        { label: "OBSERVACIONES", type: "textarea", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Desafío" },
      ],
      predefinedRows: [
        // Cada producto tiene 2 filas: una de datos normales y una de "DESAFÍO CON ESFERAS"
        { "HORA": "", "LOTE": "", "Clasificación": "", "Todos los productos pasaron a través del detector de metal plenamente funcionando": "", "Algún fragmento de metal es detectado en el producto que pasó a través del detector de metales": "", "Desafío c/hora con esferas: 2.5mm Fe, 3mm Fe, 3mm NoFe, 4mm SS - ¿Exitoso?": "", "OBSERVACIONES": "", _rowSpan: {}, _hidden: {} },
        { "HORA": "DESAFÍO CON ESFERAS", "LOTE": "-", "Clasificación": "", "Todos los productos pasaron a través del detector de metal plenamente funcionando": "-", "Algún fragmento de metal es detectado en el producto que pasó a través del detector de metales": "-", "Desafío c/hora con esferas: 2.5mm Fe, 3mm Fe, 3mm NoFe, 4mm SS - ¿Exitoso?": "", "OBSERVACIONES": "", _rowSpan: {}, _hidden: {} },
        { "HORA": "", "LOTE": "", "Clasificación": "", "Todos los productos pasaron a través del detector de metal plenamente funcionando": "", "Algún fragmento de metal es detectado en el producto que pasó a través del detector de metales": "", "Desafío c/hora con esferas: 2.5mm Fe, 3mm Fe, 3mm NoFe, 4mm SS - ¿Exitoso?": "", "OBSERVACIONES": "", _rowSpan: {}, _hidden: {} },
        { "HORA": "DESAFÍO CON ESFERAS", "LOTE": "-", "Clasificación": "", "Todos los productos pasaron a través del detector de metal plenamente funcionando": "-", "Algún fragmento de metal es detectado en el producto que pasó a través del detector de metales": "-", "Desafío c/hora con esferas: 2.5mm Fe, 3mm Fe, 3mm NoFe, 4mm SS - ¿Exitoso?": "", "OBSERVACIONES": "", _rowSpan: {}, _hidden: {} },
        { "HORA": "", "LOTE": "", "Clasificación": "", "Todos los productos pasaron a través del detector de metal plenamente funcionando": "", "Algún fragmento de metal es detectado en el producto que pasó a través del detector de metales": "", "Desafío c/hora con esferas: 2.5mm Fe, 3mm Fe, 3mm NoFe, 4mm SS - ¿Exitoso?": "", "OBSERVACIONES": "", _rowSpan: {}, _hidden: {} },
        { "HORA": "DESAFÍO CON ESFERAS", "LOTE": "-", "Clasificación": "", "Todos los productos pasaron a través del detector de metal plenamente funcionando": "-", "Algún fragmento de metal es detectado en el producto que pasó a través del detector de metales": "-", "Desafío c/hora con esferas: 2.5mm Fe, 3mm Fe, 3mm NoFe, 4mm SS - ¿Exitoso?": "", "OBSERVACIONES": "", _rowSpan: {}, _hidden: {} },
        { "HORA": "", "LOTE": "", "Clasificación": "", "Todos los productos pasaron a través del detector de metal plenamente funcionando": "", "Algún fragmento de metal es detectado en el producto que pasó a través del detector de metales": "", "Desafío c/hora con esferas: 2.5mm Fe, 3mm Fe, 3mm NoFe, 4mm SS - ¿Exitoso?": "", "OBSERVACIONES": "", _rowSpan: {}, _hidden: {} },
        { "HORA": "DESAFÍO CON ESFERAS", "LOTE": "-", "Clasificación": "", "Todos los productos pasaron a través del detector de metal plenamente funcionando": "-", "Algún fragmento de metal es detectado en el producto que pasó a través del detector de metales": "-", "Desafío c/hora con esferas: 2.5mm Fe, 3mm Fe, 3mm NoFe, 4mm SS - ¿Exitoso?": "", "OBSERVACIONES": "", _rowSpan: {}, _hidden: {} },
        { "HORA": "", "LOTE": "", "Clasificación": "", "Todos los productos pasaron a través del detector de metal plenamente funcionando": "", "Algún fragmento de metal es detectado en el producto que pasó a través del detector de metales": "", "Desafío c/hora con esferas: 2.5mm Fe, 3mm Fe, 3mm NoFe, 4mm SS - ¿Exitoso?": "", "OBSERVACIONES": "", _rowSpan: {}, _hidden: {} },
        { "HORA": "DESAFÍO CON ESFERAS", "LOTE": "-", "Clasificación": "", "Todos los productos pasaron a través del detector de metal plenamente funcionando": "-", "Algún fragmento de metal es detectado en el producto que pasó a través del detector de metales": "-", "Desafío c/hora con esferas: 2.5mm Fe, 3mm Fe, 3mm NoFe, 4mm SS - ¿Exitoso?": "", "OBSERVACIONES": "", _rowSpan: {}, _hidden: {} },
        { "HORA": "", "LOTE": "", "Clasificación": "", "Todos los productos pasaron a través del detector de metal plenamente funcionando": "", "Algún fragmento de metal es detectado en el producto que pasó a través del detector de metales": "", "Desafío c/hora con esferas: 2.5mm Fe, 3mm Fe, 3mm NoFe, 4mm SS - ¿Exitoso?": "", "OBSERVACIONES": "", _rowSpan: {}, _hidden: {} },
        { "HORA": "DESAFÍO CON ESFERAS", "LOTE": "-", "Clasificación": "", "Todos los productos pasaron a través del detector de metal plenamente funcionando": "-", "Algún fragmento de metal es detectado en el producto que pasó a través del detector de metales": "-", "Desafío c/hora con esferas: 2.5mm Fe, 3mm Fe, 3mm NoFe, 4mm SS - ¿Exitoso?": "", "OBSERVACIONES": "", _rowSpan: {}, _hidden: {} },
        { "HORA": "", "LOTE": "", "Clasificación": "", "Todos los productos pasaron a través del detector de metal plenamente funcionando": "", "Algún fragmento de metal es detectado en el producto que pasó a través del detector de metales": "", "Desafío c/hora con esferas: 2.5mm Fe, 3mm Fe, 3mm NoFe, 4mm SS - ¿Exitoso?": "", "OBSERVACIONES": "", _rowSpan: {}, _hidden: {} },
        { "HORA": "DESAFÍO CON ESFERAS", "LOTE": "-", "Clasificación": "", "Todos los productos pasaron a través del detector de metal plenamente funcionando": "-", "Algún fragmento de metal es detectado en el producto que pasó a través del detector de metales": "-", "Desafío c/hora con esferas: 2.5mm Fe, 3mm Fe, 3mm NoFe, 4mm SS - ¿Exitoso?": "", "OBSERVACIONES": "", _rowSpan: {}, _hidden: {} },
        { "HORA": "", "LOTE": "", "Clasificación": "", "Todos los productos pasaron a través del detector de metal plenamente funcionando": "", "Algún fragmento de metal es detectado en el producto que pasó a través del detector de metales": "", "Desafío c/hora con esferas: 2.5mm Fe, 3mm Fe, 3mm NoFe, 4mm SS - ¿Exitoso?": "", "OBSERVACIONES": "", _rowSpan: {}, _hidden: {} },
        { "HORA": "DESAFÍO CON ESFERAS", "LOTE": "-", "Clasificación": "", "Todos los productos pasaron a través del detector de metal plenamente funcionando": "-", "Algún fragmento de metal es detectado en el producto que pasó a través del detector de metales": "-", "Desafío c/hora con esferas: 2.5mm Fe, 3mm Fe, 3mm NoFe, 4mm SS - ¿Exitoso?": "", "OBSERVACIONES": "", _rowSpan: {}, _hidden: {} },
        { "HORA": "", "LOTE": "", "Clasificación": "", "Todos los productos pasaron a través del detector de metal plenamente funcionando": "", "Algún fragmento de metal es detectado en el producto que pasó a través del detector de metales": "", "Desafío c/hora con esferas: 2.5mm Fe, 3mm Fe, 3mm NoFe, 4mm SS - ¿Exitoso?": "", "OBSERVACIONES": "", _rowSpan: {}, _hidden: {} },
        { "HORA": "DESAFÍO CON ESFERAS", "LOTE": "-", "Clasificación": "", "Todos los productos pasaron a través del detector de metal plenamente funcionando": "-", "Algún fragmento de metal es detectado en el producto que pasó a través del detector de metales": "-", "Desafío c/hora con esferas: 2.5mm Fe, 3mm Fe, 3mm NoFe, 4mm SS - ¿Exitoso?": "", "OBSERVACIONES": "", _rowSpan: {}, _hidden: {} },
      ],
    },

    // ── Terminología ──
    {
      id: Date.now() + 402,
      type: "section",
      title: "Terminología",
      fields: [
        { label: "Nota", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },

    // ── Observación ──
    {
      id: Date.now() + 403,
      type: "observaciones",
      title: "Observación",
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
      puesto: "Obrero de Producción",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
    {
      puesto: "Jefe de Aseguramiento de Calidad",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
  ]

  return {
    codigo: "FOR-CC-16",
    nombre: "Registro Calibración y Desafío del Detector de Metal (PCC)",
    version: "1",
    fechaVersion: "2025-02-18T00:00:00Z",
    supervisa: "Proceso - Productivo",
    proceso: "Control de Calidad - Detector de Metales",
    cuandoSeUsa: "Durante cada turno de producción donde se usa detector de metales",
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
// PLANTILLA: FOR-CC-18 - CONTROL DEL AGUA EN PROCESO
// Versión: 4 | Fecha: 15/10/2025
// ============================================================
function getControlAguaTemplate() {
  const headerFields = [
    { label: "Fecha", type: "date", required: true, options: [], apiMap: "", apiEndpoint: "" },
    { label: "Turno", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "" },
  ]

  const bodyElements = []

  // PARTE 1: Recepción y Descarga
  bodyElements.push({
    id: Date.now() + 500,
    type: "tinas",
    title: "CONTROL DE AGUA - RECEPCIÓN Y DESCARGA",
    config: {
      cycles: 7,
      groups: [
        {
          name: "PEDILUVIO",
          subtitle: "DESINFECCIÓN DE BOTAS (ENTRADA PRINCIPAL) CLORO( ) / PEROXIACÉTICO ( )",
          count: 1,
          labels: ["ENTRADA PRINCIPAL"]
        },
        {
          name: "ESTACIÓN",
          subtitle: "DESINFECCIÓN DE BOTAS",
          count: 2,
          labels: ["(ÁREA RECEP. MAT. PRIMA) AGUA + PEROXIACÉTICO", "(ÁREA EMBARQUE DE CONTENEDORES) AGUA + PEROXIACÉTICO"]
        },
        {
          name: "TINA",
          subtitle: "DESINFECCIÓN PRODUCTO ENTERO (DESCARGA DE MAT. PRIMA) AGUA + HIELO + PEROXIACÉTICO",
          count: 1,
          labels: ["DESCARGA DE MAT. PRIMA"]
        },
        {
          name: "DESINFECCIÓN PRODUCTO ENTERO (PREVIO FILETEO)",
          subtitle: "AGUA + HIELO + PEROXIACÉTICO",
          count: 4,
          labels: ["TINA 1", "TINA 2", "TINA 3", "TINA 4"]
        },
        {
          name: "ESTACIONES MOVILES",
          subtitle: "DESINFECCIÓN GUANTES, CUCHILLOS, MANDILES (PROCESO FILETEO) AGUA + PEROXIACÉTICO",
          count: 1,
          labels: ["PROCESO FILETEO"]
        }
      ],
      fields: [
        { label: "SE CAMBIA AGUA", type: "radio", options: ["SI", "NO"] },
        { label: "HORA", type: "time" },
        { label: "Vol.", type: "number", suffix: "lts" },
        { label: "Resid. (I)", type: "number", suffix: "ppm" },
        { label: "Dosif.", type: "number", suffix: "ml" },
        { label: "Resid. (F)", type: "number", suffix: "ppm" }
      ]
    }
  })

  // PARTE 2: Procesos Posteriores
  bodyElements.push({
    id: Date.now() + 510,
    type: "tinas",
    title: "CONTROL DE AGUA - PROCESOS POSTERIORES",
    config: {
      cycles: 7,
      groups: [
        {
          name: "TINAS DESINFECCIÓN DE PRODUCTO (DESPUÉS DE/ ANTES DE:)",
          subtitle: "AGUA + HIELO + PEROXIACÉTICO",
          count: 2,
          labels: ["___ TINA", "___ TINA"]
        },
        {
          name: "TINAS GLASEADO DE PRODUCTO CONGELADO DURANTE PROCESO DE:",
          subtitle: "AGUA + HIELO + PEROXIACÉTICO",
          count: 2,
          labels: ["___ TINA", "___ TINA"]
        },
        {
          name: "ESTACIONES DE ENJUAGUE / DESINFECCIÓN DE PROD. DURANTE PROCESO FRESCO",
          subtitle: "AGUA + HIELO + CLORO / PEROXIACÉTICO",
          count: 2,
          labels: ["TINA 1", "TINA 2"]
        },
        {
          name: "ESTACIONES DE ENJUAGUE / DESINFECCIÓN DE PROD. DURANTE PROCESO CONGELADO",
          subtitle: "PEROXIACÉTICO / CLORO",
          count: 2,
          labels: ["TINA 3", "TINA 4"]
        }
      ],
      fields: [
        { label: "SE CAMBIA AGUA", type: "radio", options: ["SI", "NO"] },
        { label: "HORA", type: "time" },
        { label: "Vol.", type: "number", suffix: "lts" },
        { label: "Resid. (I)", type: "number", suffix: "ppm" },
        { label: "Dosif.", type: "number", suffix: "ml" },
        { label: "Resid. (F)", type: "number", suffix: "ppm" }
      ]
    }
  })

  // Observaciones
  bodyElements.push({
    id: Date.now() + 520,
    type: "observaciones",
    title: "Observaciones",
  })

  // Acciones Correctivas (tabla editable)
  bodyElements.push({
    id: Date.now() + 521,
    type: "table",
    title: "Acciones Correctivas",
    defaultRows: 3,
    columns: [
      { label: "Acción Correctiva", type: "textarea", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
    ],
  })

  // Tabla de Dosificaciones & Residual ppm
  bodyElements.push({
    id: Date.now() + 522,
    type: "table",
    title: "Dosificaciones & Residual ppm",
    defaultRows: 0,
    columns: [
      { label: "ESTACIONES - PROCESOS", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Dosificación" },
      { label: "AGUA", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Dosificación" },
      { label: "HIELO", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Dosificación" },
      { label: "CLORO 99%", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Dosificación" },
      { label: "PEROX. 15%", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Dosificación" },
      { label: "RESIDUAL ppm", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Resultado" },
      { label: "CAMBIO/DESINF.", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Resultado" },
    ],
    predefinedRows: [
      { "ESTACIONES - PROCESOS": "PEDILUVIO", "AGUA": "500 lts", "HIELO": "-", "CLORO 99%": "-", "PEROX. 15%": "533.33 ml", "RESIDUAL ppm": "160 ppm", "CAMBIO/DESINF.": "CADA 2 HORAS", _rowSpan: {}, _hidden: {} },
      { "ESTACIONES - PROCESOS": "ESTACIÓN DE DESINFECCIÓN DE BOTAS", "AGUA": "25 lts", "HIELO": "-", "CLORO 99%": "1000 ml", "PEROX. 15%": "26.67 ml", "RESIDUAL ppm": "200 ppm", "CAMBIO/DESINF.": "160 ppm", _rowSpan: {}, _hidden: {} },
      { "ESTACIONES - PROCESOS": "DESINFECCIÓN DE MATERIA PRIMA (ENTERO)", "AGUA": "300 lts", "HIELO": "100 kg", "CLORO 99%": "-", "PEROX. 15%": "213.33 ml", "RESIDUAL ppm": "80 ppm", "CAMBIO/DESINF.": "CADA 2 HORAS", _rowSpan: {}, _hidden: {} },
      { "ESTACIONES - PROCESOS": "ESTACIÓN MOVIL DE DESINFECCIÓN DE UTENSILIOS", "AGUA": "25 lts", "HIELO": "-", "CLORO 99%": "-", "PEROX. 15%": "26.67 ml", "RESIDUAL ppm": "160 ppm", "CAMBIO/DESINF.": "CADA HORA", _rowSpan: {}, _hidden: {} },
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
      puesto: "Aseguramiento De Calidad",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
  ]

  return {
    codigo: "FOR-CC-18-B",
    nombre: "Control del Agua en Proceso (Clorinación y Peroxiacético) - DUPLICADO",
    version: "4",
    fechaVersion: "2025-10-15T00:00:00Z",
    supervisa: "Proceso - Productivo",
    proceso: "Control de Calidad - Agua en Proceso",
    cuandoSeUsa: "Durante cada turno de producción para control de agua",
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
// PLANTILLA: FOR-CC-21 - CONTROL DE ALMACENAMIENTO REFRIGERADO
// Versión: 1 | Fecha: 24/2/2025
// ============================================================
function getAlmacenamientoRefrigeradoTemplate() {
  const headerFields = [
    { label: "Fecha", type: "date", required: true, options: [], apiMap: "", apiEndpoint: "" },
    { label: "Especie / Presentación", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "" },
    { label: "Lote", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "" },
  ]

  // Columnas del inicio de proceso
  const inicioProcesoColumns = [
    { label: "# TINA", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Inicio Proceso" },
    { label: "HORA (Inicio)", type: "time", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Inicio Proceso" },
    { label: "TEMP. T°C (Inicio)", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Inicio Proceso" },
  ]

  // Columnas de finaliza proceso / inicia almacenamiento
  const finalizaColumns = [
    { label: "HORA (Finaliza/Inicia Almac.)", type: "time", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Finaliza Proc." },
    { label: "¿SE COLOCÓ SUFICIENTE CANTIDAD DE HIELO ALREDEDOR DEL PRODUCTO DURANTE EL ENHIELADO TIPO SÁNDWICH?", type: "select", required: false, options: ["S", "NO"], apiMap: "", apiEndpoint: "", formula: "", group: "Finaliza Proc." },
    { label: "T°C PROM. T°S PESCADO (Finaliza)", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Finaliza Proc." },
  ]

  // Columnas de cada control día
  const controlDiaColumns = (dia) => [
    { label: `HORA (Control Día ${dia})`, type: "time", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: `Control Día ${dia}` },
    { label: `SUFICIENTE HIELO ALREDEDOR DEL PRODUCTO (Día ${dia})`, type: "select", required: false, options: ["S", "NO"], apiMap: "", apiEndpoint: "", formula: "", group: `Control Día ${dia}` },
    { label: `T°C PROM. DEL PROD. (Día ${dia})`, type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: `Control Día ${dia}` },
  ]

  const allColumns = [
    ...inicioProcesoColumns,
    ...finalizaColumns,
    ...controlDiaColumns(1),
    ...controlDiaColumns(2),
    ...controlDiaColumns(3),
    ...controlDiaColumns(4),
    { label: "OBSERVACIÓN / ACCIÓN CORRECTIVA", type: "textarea", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Observación" },
  ]

  const bodyElements = [
    // ── Fechas de Control ──
    {
      id: Date.now() + 600,
      type: "section",
      title: "Fechas de Control Diario",
      fields: [
        { label: "Fecha Control Día 1", type: "date", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Fecha Control Día 2", type: "date", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Fecha Control Día 3", type: "date", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Fecha Control Día 4", type: "date", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },

    // ── Tabla Principal ──
    {
      id: Date.now() + 601,
      type: "table",
      title: "Control de Almacenamiento Refrigerado (por Tina)",
      defaultRows: 20,
      columns: allColumns,
    },

    // ── Se repone hielo ──
    {
      id: Date.now() + 602,
      type: "section",
      title: "Reposición de Hielo",
      fields: [
        { label: "¿SE REPONE HIELO?", type: "radio", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },

    // ── Material ──
    {
      id: Date.now() + 603,
      type: "table",
      title: "Material Utilizado",
      defaultRows: 3,
      columns: [
        { label: "MATERIAL", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Material" },
        { label: "LOTE", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Material" },
        { label: "SE UTILIZÓ EN:", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Material" },
      ],
    },

    // ── Observaciones ──
    {
      id: Date.now() + 604,
      type: "observaciones",
      title: "Observaciones Generales",
    },

    // ── Acciones Correctivas ──
    {
      id: Date.now() + 605,
      type: "section",
      title: "Acciones Correctivas",
      fields: [
        { label: "Acciones Correctivas", type: "textarea", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },
  ]

  const firmas = [
    {
      puesto: "Operador",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
    {
      puesto: "Supervisor de Aseguram. Calidad",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
    {
      puesto: "Jefe de Aseguram. Calidad",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
  ]

  return {
    codigo: "FOR-CC-21",
    nombre: "Control de Almacenamiento Refrigerado de Producto con CO (Cantidad de Hielo, T°C y Tiempo) PCC",
    version: "1",
    fechaVersion: "2025-02-24T00:00:00Z",
    supervisa: "Proceso - Productivo",
    proceso: "Control de Calidad - Almacenamiento Refrigerado",
    cuandoSeUsa: "Durante el almacenamiento refrigerado de producto con hielo",
    quienLoLlena: "Operador",
    frecuencia: "Diaria / por lote",
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
// PLANTILLA: FOR-CC-34 - LISTA DE INSPECCIÓN SANITARIA DE ÁREAS NO PRODUCTIVAS
// Versión: 2 | Fecha: 24/04/2025
// ============================================================
function getInspeccionAreasNoProductivasTemplate() {
  const headerFields = [
    { label: "Fecha/Hora", type: "datetime-local", required: true, options: [], apiMap: "", apiEndpoint: "" },
  ]

  const areas = {
    "BODEGA DE INSUMOS": [
      "Se encuentra limpia y ordenada",
      "Se observan las puertas cerradas y debidamente protegidas",
      "Ausencia de plagas, insectos",
    ],
    "BODEGA DE CARTONES": [
      "Se encuentra limpia y ordenada",
      "Se observan las puertas cerradas y debidamente protegidas",
      "Ausencia de plagas, insectos",
    ],
    "ÁREA PROVISIONAL DE DESECHOS PLÁSTICOS": [
      "Se encuentra limpia y ordenada",
      "Área señalizada",
      "Ausencia de plagas, insectos",
    ],
    "ÁREA DE MANTENIMIENTO": [
      "Se encuentra limpia y ordenada",
      "Químicos rotulados y almacenados correctamente",
      "Áreas señalizadas",
      "Canales de desagüe limpios y secos",
      "Ausencia de plagas, insectos",
      "Lavamanos en buen estado, con abastecimiento de agua, papel y jabón.",
    ],
    "ÁREA DE LAVADO DE TANQUES": [
      "Se encuentra limpia y ordenada",
      "Químicos rotulados y almacenados correctamente",
      "Área señalizada",
      "Cisternas se encuentran con candado",
      "Canales de desagüe limpios y secos",
      "Zona para tanques por lavar bien delimitada",
      "Ausencia de plagas, insectos",
      "Llaves y mangueras en buen estado, sin fugas.",
    ],
    "ZONAS EXTERNAS Y PERÍMETRO": [
      "Se encuentra limpia, libre de maleza y otros desechos",
      "Disponibilidad de contenedores para desechos (limpios)",
      "Ausencia de plagas, insectos",
    ],
    "PATIO PRINCIPAL (ZONA PUNTO DE REUNIÓN)": [
      "Se encuentra limpia",
      "Disponibilidad de contenedores para desechos (limpios)",
      "Ausencia de plagas, insectos",
    ],
    "ZONA DE CARGA DE CONTENEDORES (PATIO DE CÁMARA)": [
      "Área de patio se encuentra limpia",
      "Disponibilidad de contenedores para desechos (limpios)",
      "Dispensadores de jabón de manos abastecidos",
      "Zona para tanques limpios bien delimitada",
      "Químicos rotulados y almacenados correctamente",
      "Ausencia de plagas, insectos",
      "Buen funcionamiento de los lavamanos",
    ],
  }

  // Construir filas predefinidas: cada área es un header + sus ítems
  const predefinedRows = []
  Object.entries(areas).forEach(([areaName, items]) => {
    // Fila de encabezado de área (nombre en negritas)
    predefinedRows.push({
      "ÁREA": areaName,
      "SI": "",
      "NO": "",
      "OBSERVACIONES": "",
      "ACCIÓN CORRECTIVA": "",
      _rowSpan: {},
      _hidden: {},
      _isHeader: true,
    })
    items.forEach((item) => {
      predefinedRows.push({
        "ÁREA": item,
        "SI": "",
        "NO": "",
        "OBSERVACIONES": "",
        "ACCIÓN CORRECTIVA": "",
        _rowSpan: {},
        _hidden: {},
      })
    })
  })

  const bodyElements = [
    {
      id: Date.now() + 700,
      type: "table",
      title: "Inspección Sanitaria de Áreas No Productivas",
      defaultRows: 0,
      columns: [
        { label: "ÁREA", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "SI", type: "checkbox", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "NO", type: "checkbox", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "OBSERVACIONES", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "ACCIÓN CORRECTIVA", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
      predefinedRows: predefinedRows,
    },
  ]

  const firmas = [
    {
      puesto: "Inspeccionado por",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
    {
      puesto: "Revisado por",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
  ]

  return {
    codigo: "FOR-CC-34",
    nombre: "Lista de Inspección Sanitaria de Áreas No Productivas",
    version: "2",
    fechaVersion: "2025-04-24T00:00:00Z",
    supervisa: "Proceso - Productivo",
    proceso: "Control de Calidad - Inspección Sanitaria",
    cuandoSeUsa: "Para verificar condiciones sanitarias de áreas no productivas",
    quienLoLlena: "Inspector de calidad",
    frecuencia: "Periódica",
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
// PLANTILLA: FOR-CC-36 - REGISTRO DE LIMPIEZA DE TANQUES Y TINAS
// Versión: 1 | Fecha: 03/04/2025
// ============================================================
function getLimpiezaTanquesTinasTemplate() {
  const headerFields = [
    { label: "Fecha", type: "date", required: true, options: [], apiMap: "", apiEndpoint: "" },
  ]

  // 6 bloques de limpieza (cada uno con H. INICIO y H. FINAL)
  const bloques = []
  for (let b = 1; b <= 6; b++) {
    bloques.push({
      id: Date.now() + 800 + b,
      type: "table",
      title: `Bloque ${b}`,
      defaultRows: 5,
      columns: [
        { label: "HORA", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Registro" },
        { label: "No. Tanque / Tina", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Registro" },
        { label: "LIMPIÓ TAPA", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "", group: "Registro" },
        { label: "VERIFICADOR / SUPERVISOR (OK/NO)", type: "select", required: false, options: ["OK", "NO"], apiMap: "", apiEndpoint: "", formula: "", group: "Verificación" },
        { label: "RESPONSABLE DE LA LIMPIEZA", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Verificación" },
        { label: "TINAS PLASTICAS PRODUCTO", type: "checkbox", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Observación" },
        { label: "TINAS SUBPRODUCTO", type: "checkbox", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Observación" },
        { label: "TANQUES DE PRODUCTO", type: "checkbox", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Observación" },
        { label: "PALLETS PLÁSTICOS", type: "checkbox", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Observación" },
      ],
    })
  }

  const bodyElements = [
    ...bloques,

    // Control de Máquina Hidrolavadora Karcher
    {
      id: Date.now() + 810,
      type: "section",
      title: "Control de Máquina Hidrolavadora Karcher",
      fields: [
        { label: "CAMBIO DE ACEITE DE LA MAQUINA", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "OTROS MANTENIMIENTOS ADICIONALES", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "OBSERVACIONES DE LA MAQUINA", type: "textarea", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },

    // Observación general
    {
      id: Date.now() + 811,
      type: "observaciones",
      title: "Observación",
    },
  ]

  const firmas = [
    {
      puesto: "Responsable de la Limpieza",
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
    codigo: "FOR-CC-36",
    nombre: "Registro de Limpieza de Tanques y Tinas",
    version: "1",
    fechaVersion: "2025-04-03T00:00:00Z",
    supervisa: "Proceso - Productivo",
    proceso: "Control de Calidad - Limpieza",
    cuandoSeUsa: "Para registrar la limpieza de tanques y tinas de proceso",
    quienLoLlena: "Responsable de la Limpieza",
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
// PLANTILLA: FOR-CC-4 - INSPECCIÓN DE CONDICIONES SANITARIAS
// DE LAS ÁREAS DE PROCESO (PRE-OPERATIVA Y EN CADA CAMBIO)
// Versión: 5 | Fecha: 15/10/2025
// ============================================================
function getInspeccionSanitariaAreasTemplate() {
  const headerFields = [
    { label: "Fecha", type: "date", required: true, options: [], apiMap: "", apiEndpoint: "" },
    { label: "Supervisores de proceso", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "" },
  ]

  const areasPreOperativa = [
    "RECEPCIÓN DE MATERIA PRIMA",
    "SILO DE HIELO",
    "ÁREA DE PROCESO 2 (vL)",
    "PROCESO DE FILETEO",
    "ÁREA DE CO (ELIMINACIÓN DE CO DE LA FUNDA)",
    "MANTENIMIENTO REFRIGERADO",
    "LIMPIEZA, CLASIF. EMPAQ. Y SELLADO DE PRODUCTO FRESCO",
    "LIBERACIÓN DE PRODUCTO DE TÚNELES EMPAQ. FINAL / PROVISIONAL",
    "CORTE DE PRODUCTO CONGELADO",
    "CLASIFICACIÓN DE PORCIONES CONGELADAS",
    "SELLADO AL VACÍO DE PRODUCTO CONGELADO",
    "EMPAQUE FINAL DE PRODUCTO CONGELADO",
    "PRE-TÚNEL / TÚNELES T1, T2, T3 y T4",
    "PRE-CÁMARA / CÁMARA Pc1, Pc2, Pc3, Pc4",
    "CÁMARA DE REFRIGERACIÓN",
    "MANTENIMIENTO DE SUB-PRODUCTOS",
  ]

  const preOperativaRows = areasPreOperativa.map((area) => ({
    "HORA INSPECCIÓN": "",
    "INSPECCIÓN (ÁREAS DE PROCESO)": area,
    "CONDICIÓN SATISFACTORIA DE INSTALACIONES / SUPERFICIES DE CONTACTO / MAQUINARIAS / EQUIPOS (FÍSICO Y SANITARIO)": "",
    "SE HA RETIRADO MATERIAL DE ENVASADO Y ETIQUETADO DEL PROCESO ANTERIOR?": "",
    "PRESENCIA DE PLAGAS": "",
    _rowSpan: {}, _hidden: {},
  }))

  const bodyElements = [
    // Inspección Pre-Operativa
    {
      id: Date.now() + 900,
      type: "table",
      title: "INSPECCIÓN PRE-OPERATIVA - PREVENCIÓN A LA CONTAMINACIÓN CRUZADA",
      defaultRows: 0,
      columns: [
        { label: "HORA INSPECCIÓN", type: "time", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "INSPECCIÓN (ÁREAS DE PROCESO)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "CONDICIÓN SATISFACTORIA DE INSTALACIONES / SUPERFICIES DE CONTACTO / MAQUINARIAS / EQUIPOS (FÍSICO Y SANITARIO)", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "SE HA RETIRADO MATERIAL DE ENVASADO Y ETIQUETADO DEL PROCESO ANTERIOR?", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "PRESENCIA DE PLAGAS", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "" },
      ],
      predefinedRows: preOperativaRows,
    },

    // Inspección Durante Proceso (Mañana)
    {
      id: Date.now() + 901,
      type: "table",
      title: "INSPECCIÓN DURANTE PROCESO (MAÑANA)",
      defaultRows: 5,
      columns: [
        { label: "HORA INSPECCIÓN", type: "time", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "INSPECCIÓN DE ÁREAS DE PROCESO (Indique el área a inspeccionar)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "CAMBIO DE PRODUCTO", type: "checkbox", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Motivo de la Inspección" },
        { label: "CAMBIO LOTE", type: "checkbox", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Motivo de la Inspección" },
        { label: "LIMPIEZA Y DESINFECCIÓN SATISFACTORIA DEL ÁREA Y SUPERFICIES?", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "SE HA RETIRADO MATERIAL DE ENVASADO Y ETIQUETADO DEL PROCESO O LOTE ANTERIOR?", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },

    // Enjuague y Sanitización
    {
      id: Date.now() + 902,
      type: "section",
      title: "Enjuague y Sanitización",
      fields: [
        { label: "ENJUAGUE Y SANITIZACIÓN DE MESAS Y UTENSILIOS DURANTE PROCESO C/2 HORAS", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },

    // Subproductos
    {
      id: Date.now() + 903,
      type: "table",
      title: "Subproductos Generados a Partir de los Productos",
      defaultRows: 0,
      columns: [
        { label: "ASPECTO", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "SI / NO", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "" },
      ],
      predefinedRows: [
        { "ASPECTO": "SEPARADOS DEL PISO CONSTANTEMENTE", "SI / NO": "", _rowSpan: {}, _hidden: {} },
        { "ASPECTO": "RECOLECTADOS / RECOGIDOS CONTINUAMENTE", "SI / NO": "", _rowSpan: {}, _hidden: {} },
        { "ASPECTO": "CUBIERTOS / TAPADOS Y SEPARADOS DEL ÁREA", "SI / NO": "", _rowSpan: {}, _hidden: {} },
        { "ASPECTO": "RETIRADOS POR VEHÍCULOS PARTICULARES Mínimo Cada 4 Hrs.", "SI / NO": "", _rowSpan: {}, _hidden: {} },
      ],
    },

    // Estaciones de lavamanos
    {
      id: Date.now() + 904,
      type: "table",
      title: "Revisión del Estado y Funcionamiento de las Estaciones de Lavamanos",
      defaultRows: 0,
      columns: [
        { label: "ASPECTO", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "SI / NO", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "" },
      ],
      predefinedRows: [
        { "ASPECTO": "BUEN FUNCIONAMIENTO, SIN FUGAS", "SI / NO": "", _rowSpan: {}, _hidden: {} },
        { "ASPECTO": "BUEN FUNCIONAMIENTO DEL SECADOR", "SI / NO": "", _rowSpan: {}, _hidden: {} },
        { "ASPECTO": "ABASTECIMIENTO DE JABÓN", "SI / NO": "", _rowSpan: {}, _hidden: {} },
        { "ASPECTO": "TEMPERATURA DEL AGUA", "SI / NO": "", _rowSpan: {}, _hidden: {} },
      ],
    },

    // Nota
    {
      id: Date.now() + 905,
      type: "section",
      title: "NOTA",
      fields: [
        { label: "NOTA: Cuando El Inspector de Aseg. de Calidad evidencie cualquier peligro inminente que pueda ocasionar directa o indirectamente algún tipo de contaminación hacia el producto, deberá comunicar al dpto. de mantenimiento para que solucione. No podrán iniciar las labores y/o seguir procesando en el área afectada si el problema no se ha resuelto.", type: "label", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },

    // Observación
    {
      id: Date.now() + 906,
      type: "observaciones",
      title: "Observación",
    },

    // Acción correctiva
    {
      id: Date.now() + 907,
      type: "section",
      title: "Acción Correctiva",
      fields: [
        { label: "Acción correctiva", type: "textarea", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },
  ]

  const firmas = [
    {
      puesto: "Inspeccionado por - Aseguramiento de Calidad",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
    {
      puesto: "Revisado por - Aseguramiento de Calidad",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
  ]

  return {
    codigo: "FOR-CC-4",
    nombre: "Inspección de Condiciones Sanitarias de las Áreas de Proceso (Pre-Operativa y en Cada Cambio de Producto/Lote)",
    version: "5",
    fechaVersion: "2025-10-15T00:00:00Z",
    supervisa: "Proceso - Productivo",
    proceso: "Control de Calidad - Inspección Sanitaria",
    cuandoSeUsa: "Pre-operativa y en cada cambio de producto o lote",
    quienLoLlena: "Inspector de Aseg. de Calidad",
    frecuencia: "Diaria / por cambio",
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
// PLANTILLA: FOR-CC-38 - VERIFICACIÓN DE BALANZAS
// Versión: 2 | Fecha: 12/05/2025
// ============================================================
function getVerificacionBalanzasTemplate() {
  const headerFields = [
    { label: "Fecha y Hora", type: "datetime-local", required: true, options: [], apiMap: "", apiEndpoint: "" },
  ]

  const balanzasData = [
    { n: "01", marca: "SUPER-6", serie: "S63022E011", tipo: "GRAMERA", capacidad: "15 kg", division: "0.002 kg" },
    { n: "02", marca: "CAS", serie: "19H0604009", tipo: "GRAMERA", capacidad: "15 kg", division: "0.002kg" },
    { n: "03", marca: "CAS", serie: "19H0604010", tipo: "GRAMERA", capacidad: "15 kg", division: "0.002kg" },
    { n: "04", marca: "CAS WATERPROOF", serie: "NXK22I110347", tipo: "DE CUELLO", capacidad: "18 kg", division: "0.002 kg" },
    { n: "05", marca: "CAS", serie: "17H03007075", tipo: "GRAMERA", capacidad: "15 kg", division: "0.002 kg" },
    { n: "06", marca: "CAS", serie: "XH21080150341", tipo: "GRAMERA", capacidad: "15 kg", division: "0.002 kg" },
    { n: "07", marca: "CAS WATERPROOF", serie: "8336806025", tipo: "GRAMERA", capacidad: "18 kg", division: "0.002 kg" },
    { n: "08", marca: "CAS", serie: "17H09004477", tipo: "GRAMERA", capacidad: "15 kg", division: "0.005 kg" },
    { n: "09", marca: "CAS", serie: "XH20070068876", tipo: "GRAMERA", capacidad: "15 Kg", division: "0.002 kg" },
    { n: "10", marca: "CAS WATERPROOF", serie: "8336806025", tipo: "BALANZA DE CUELLO", capacidad: "50 Kg", division: "0.005 kg" },
    { n: "11", marca: "CAS WATERPROOF", serie: "17080842", tipo: "GRAMERA", capacidad: "15 Kg", division: "0.002 kg" },
    { n: "12", marca: "SUPER S6", serie: "5615004", tipo: "GRAMERA", capacidad: "15 kg", division: "0.002 kg" },
    { n: "13", marca: "CAS", serie: "17H03007068", tipo: "GRAMERA", capacidad: "15 kg", division: "0.002 kg" },
    { n: "14", marca: "CAS", serie: "17H03007070", tipo: "GRAMERA", capacidad: "15 kg", division: "0.002 kg" },
    { n: "15", marca: "CAS", serie: "17H09004478", tipo: "GRAMERA", capacidad: "15 kg", division: "0.002 kg" },
    { n: "16", marca: "CAS", serie: "XH20070068878", tipo: "GRAMERA", capacidad: "15 kg", division: "0.002 kg" },
    { n: "17", marca: "CAS WATERPROOF", serie: "XH20070068877", tipo: "GRAMERA", capacidad: "15 kg", division: "0.002 kg" },
    { n: "18", marca: "WATER PROS", serie: "XH24100100153", tipo: "GRAMERA", capacidad: "30 kg", division: "2 g" },
    { n: "19", marca: "SUPER-6", serie: "S63022E014", tipo: "GRAMERA", capacidad: "15 kg", division: "0.002 kg" },
    { n: "20", marca: "SUPER-6", serie: "S3022E012", tipo: "GRAMERA", capacidad: "15 kg", division: "0.002 kg" },
    { n: "21", marca: "METTLER TOLEDO", serie: "08081-6JK", tipo: "COLGANTE", capacidad: "500 kg", division: "0.5 kg" },
    { n: "22", marca: "CAS WATERPROOF", serie: "19050435", tipo: "COLGANTE", capacidad: "500 kg", division: "0.5 kg" },
    { n: "23", marca: "CAS WATERPROOF", serie: "WXK21070009", tipo: "BALANZA DE CUELLO", capacidad: "30 kg", division: "0.1 kg" },
    { n: "24", marca: "METTLER TOLEDO", serie: "B651462101", tipo: "PLATAFORMA", capacidad: "2000 kg", division: "0.5 kg" },
    { n: "25", marca: "CAS WATERPROOF", serie: "WXK21070041", tipo: "BALANZA DE CUELLO", capacidad: "200 Kg", division: "0.01 kg" },
    { n: "26", marca: "CAS", serie: "740390", tipo: "PLATAFORMA", capacidad: "2000 kg", division: "1 kg" },
    { n: "27", marca: "CAS", serie: "911372", tipo: "PLATAFORMA", capacidad: "2000 kg", division: "1 kg" },
    { n: "28", marca: "CAS", serie: "XH2007006875", tipo: "GRAMERA", capacidad: "15 kg", division: "0.002 kg" },
    { n: "29", marca: "CAS", serie: "13283", tipo: "BALANZA DE CUELLO", capacidad: "200 kg", division: "0.1 kg" },
    { n: "30", marca: "HIWEIGH", serie: "XH2007006146", tipo: "BALANZA DE CUELLO", capacidad: "300 kg", division: "50 gr" },
    { n: "31", marca: "CAS", serie: "19H0604012", tipo: "GRAMERA", capacidad: "15 kg", division: "0.002 kg" },
    { n: "32", marca: "SUPER-6", serie: "S63022E018", tipo: "GRAMERA", capacidad: "15 kg", division: "0.002 kg" },
    { n: "33", marca: "CAS WATERPROOF", serie: "19050432", tipo: "BALANZA DE CUELLO", capacidad: "200 kg", division: "0.1 kg" },
    { n: "34", marca: "CAS", serie: "XH190079005", tipo: "GRAMERA", capacidad: "15 kg", division: "0.002 kg" },
    { n: "35", marca: "WATER PROS", serie: "XH24100100152", tipo: "GRAMERA", capacidad: "30 kg", division: "2 g" },
    { n: "36", marca: "CAS WATERPROOF", serie: "XH2202001368", tipo: "GRAMERA", capacidad: "30 kg", division: "2 kg" },
    { n: "37", marca: "CAS", serie: "XH190079008", tipo: "GRAMERA", capacidad: "15 kg", division: "0.002 kg" },
    { n: "38", marca: "SUPER-SS", serie: "XH21050041090", tipo: "GRAMERA", capacidad: "15 kg", division: "0.002 kg" },
    { n: "39", marca: "WATERPROOF", serie: "XH21050041087", tipo: "GRAMERA", capacidad: "15 kg", division: "0.002 kg" },
    { n: "40", marca: "SUPER-SS", serie: "XH21050041088", tipo: "GRAMERA", capacidad: "15 kg", division: "0.002 kg" },
    { n: "41", marca: "SUPER-SS", serie: "XH21050041121", tipo: "GRAMERA", capacidad: "15 kg", division: "0.002 kg" },
    { n: "42", marca: "DA600", serie: "51920", tipo: "ANALÍTICA", capacidad: "600 g", division: "0.01 g" },
    { n: "43", marca: "BENCH SCALE", serie: "XH24100100587", tipo: "BALANZA DE CUELLO", capacidad: "500 kg", division: "50 g" },
    { n: "44", marca: "BENCH SCALE", serie: "XH24030040634", tipo: "BALANZA DE CUELLO", capacidad: "200 kg", division: "20 g" },
  ]

  const predefinedRows = balanzasData.map((b) => ({
    "N° BALANZA": b.n,
    "MARCA DE BALANZA": b.marca,
    "SERIE DE BALANZA": b.serie,
    "TIPO DE BALANZA": b.tipo,
    "CAPACIDAD DE BALANZA": b.capacidad,
    "DIVISIÓN DE ESCALA (d)": b.division,
    "MASA PATRÓN 1 (g)": "",
    "MASA PATRÓN 2 (g)": "",
    "MASA PATRÓN 3 (g)": "",
    "MASA PATRÓN 4 (g)": "",
    "APROB.": "",
    "ÁREA DE PROC.": "",
    "OBSERVACIONES": "",
    _rowSpan: {}, _hidden: {},
  }))

  const bodyElements = [
    {
      id: Date.now() + 1000,
      type: "table",
      title: "Verificación de Balanzas",
      defaultRows: 0,
      columns: [
        { label: "N° BALANZA", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Datos de la Balanza" },
        { label: "MARCA DE BALANZA", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Datos de la Balanza" },
        { label: "SERIE DE BALANZA", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Datos de la Balanza" },
        { label: "TIPO DE BALANZA", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Datos de la Balanza" },
        { label: "CAPACIDAD DE BALANZA", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Datos de la Balanza" },
        { label: "DIVISIÓN DE ESCALA (d)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Datos de la Balanza" },
        { label: "MASA PATRÓN 1 (g)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Masas Patrón (Gramos) Utilizada para la Verificación" },
        { label: "MASA PATRÓN 2 (g)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Masas Patrón (Gramos) Utilizada para la Verificación" },
        { label: "MASA PATRÓN 3 (g)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Masas Patrón (Gramos) Utilizada para la Verificación" },
        { label: "MASA PATRÓN 4 (g)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Masas Patrón (Gramos) Utilizada para la Verificación" },
        { label: "APROB.", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "", group: "Verificación" },
        { label: "ÁREA DE PROC.", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Verificación" },
        { label: "OBSERVACIONES", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
      predefinedRows: predefinedRows,
    },

    // Observaciones Generales
    {
      id: Date.now() + 1001,
      type: "observaciones",
      title: "Observaciones Generales",
    },

    // Acciones Correctivas
    {
      id: Date.now() + 1002,
      type: "section",
      title: "Acciones Correctivas",
      fields: [
        { label: "Acciones Correctivas", type: "textarea", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },
  ]

  const firmas = [
    {
      puesto: "Elaborado por - Aseguramiento de Calidad",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
    {
      puesto: "Revisión - Jefe de Aseguramiento de Calidad",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
  ]

  return {
    codigo: "FOR-CC-38",
    nombre: "Verificación de Balanzas",
    version: "2",
    fechaVersion: "2025-05-12T00:00:00Z",
    supervisa: "Proceso - Productivo",
    proceso: "Control de Calidad - Verificación de Equipos",
    cuandoSeUsa: "Para verificar el estado y calibración de las balanzas",
    quienLoLlena: "Aseguramiento de Calidad",
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
// PLANTILLA: FOR-CC-06 - CONTROL DE EMPAQUE FINAL
// Versión: 1 | Fecha: 14/04/2025
// ============================================================
function getEmpaqueFinaTemplate() {
  const headerFields = [
    { label: "Fecha", type: "date", required: true, options: [], apiMap: "", apiEndpoint: "" },
    { label: "Hora", type: "time", required: false, options: [], apiMap: "", apiEndpoint: "" },
    { label: "Producto", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "" },
    { label: "Lote", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "" },
    { label: "Cliente", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "" },
  ]

  const bodyElements = [
    {
      id: Date.now() + 600,
      type: "table",
      title: "Control de Empaque Final",
      defaultRows: 3,
      autoSumColumns: true,
      columns: [
        { label: "ESPECIFICACIÓN MATERIAL EXTRAÑO", type: "select", required: false, options: ["Conforme", "No Conforme"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "PIEZAS FUERA DE ESPECIFICACIÓN", type: "select", required: false, options: ["Conforme", "No Conforme"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "COLOR UNIFORME", type: "select", required: false, options: ["Conforme", "No Conforme"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "CARTÓN MASTER", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "PESO TARA / CAJA (LBS)" },
        { label: "BOLSAS MASTER", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "PESO TARA / CAJA (LBS)" },
        { label: "FUNDAS DEL VACÍO", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "PESO TARA / CAJA (LBS)" },
        { label: "GLASEO", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "PESO TARA / CAJA (LBS)" },
        { label: "PLÁSTICO", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "PESO TARA / CAJA (LBS)" },
        { label: "FOAM", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "PESO TARA / CAJA (LBS)" },
        { label: "TARA CAJA", type: "formula", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "[CARTÓN MASTER] + [BOLSAS MASTER] + [FUNDAS DEL VACÍO] + [GLASEO] + [PLÁSTICO] + [FOAM]" },
        { label: "PESO NETO CAJAS (LBS)", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "CONTENIDO CAJA" },
        { label: "PESO BRUTO DE CAJAS / FUNDA (LBS)", type: "formula", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "[PESO NETO CAJAS (LBS)] + [TARA CAJA]", group: "CONTENIDO CAJA" },
        { label: "# DE BOLSAS MASTER / FUNDAS VACÍO X CAJA", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
      predefinedRows: [],
    },
  ]

  const firmas = [
    {
      rol: "Supervisor de Calidad",
      nombre: "",
      puestoId: null,
      fecha: "",
      hora: "",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
  ]

  return {
    codigo: "FOR-CC-06",
    nombre: "Control de Empaque Final",
    version: "1",
    fechaVersion: "2025-04-14T00:00:00Z",
    supervisa: "Proceso - Productivo",
    proceso: "Control de Calidad - Empaque Final",
    cuandoSeUsa: "Durante el empaque final de producto congelado",
    quienLoLlena: "Supervisor de Calidad",
    frecuencia: "Por lote",
    isMasterForm: false,
    autoSumColumns: true,
    usaApi: false,
    isDraft: false,
    isObsolete: false,
    headerFields: JSON.stringify(headerFields),
    bodyElements: JSON.stringify(bodyElements),
    firmas: JSON.stringify(firmas),
  }
}

// ============================================================
// PLANTILLA: FOR-CC-40 - MONITOREO-VERIFICACIÓN DE
// ESPECIFICACIONES DE PRODUCTOS TERMINADOS
// Versión: 1 | Fecha: 14/04/2025
// ============================================================
function getMonitoreoProductosTerminadosTemplate() {
  const headerFields = [
    { label: "Fecha", type: "date", required: true, options: [], apiMap: "", apiEndpoint: "" },
    { label: "Hora", type: "time", required: false, options: [], apiMap: "", apiEndpoint: "" },
    { label: "Muestreo #", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "" },
  ]

  const bolsaColumns = []
  for (let i = 1; i <= 10; i++) {
    bolsaColumns.push(
      { label: `BOLSA ${i}`, type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" }
    )
  }

  const porcionesRows = []
  for (let r = 1; r <= 12; r++) {
    const row = { "N°": r.toString(), _rowSpan: {}, _hidden: {} }
    for (let b = 1; b <= 10; b++) {
      row[`BOLSA ${b}`] = ""
    }
    porcionesRows.push(row)
  }
  
  // Array de columnas calculadas para MÁXIMOS Y MÍNIMOS
  const bolsaColumnsCalculadas = []
  for (let i = 1; i <= 10; i++) {
    bolsaColumnsCalculadas.push({
      label: `BOLSA ${i}`,
      type: "calculated",
      required: false,
      options: [],
      apiMap: "",
      apiEndpoint: "",
      // Fila 0 = MÁXIMO, Fila 1 = MÍNIMO, Fila 2 = COEF. UNIF.
      formula: `_ROW_ == 0 ? ([BOLSA ${i}[max]] ? (([BOLSA ${i}[max]] - [FUNDA VP: PESO UND. (ONZ)]) / (([GLASEO: PORCENTAJE] / 100) + 1)) : "") : (_ROW_ == 1 ? ([BOLSA ${i}[min]] ? (([BOLSA ${i}[min]] - [FUNDA VP: PESO UND. (ONZ)]) / (([GLASEO: PORCENTAJE] / 100) + 1)) : "") : ([BOLSA ${i}[max]] && [BOLSA ${i}[min]] ? (([BOLSA ${i}[max]] - [FUNDA VP: PESO UND. (ONZ)]) / ([BOLSA ${i}[min]] - [FUNDA VP: PESO UND. (ONZ)])) : ""))`
    })
  }

  const bodyElements = [
    // Datos Generales del Producto
    {
      id: Date.now() + 1100,
      type: "section",
      title: "Datos Generales del Producto",
      fields: [
        { label: "PRODUCTO / CLASIFICACIÓN", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "SUPERV. C. CALIDAD", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "TIPO EMPAQUE - CAJA (LBS)", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "TIPO EMPAQUE - FUNDA MASTER (LBS)", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "RANGO CLASIF. PORCIONES oz (Mín.)", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "RANGO CLASIF. PORCIONES oz (Máx.)", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "LOTE", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "CLIENTE", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "FECHA EMPAQUE", type: "date", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },

    // Peso Tara CAJA
    {
      id: Date.now() + 1101,
      type: "section",
      title: "Verificación del Producto / Contenido por Caja - Peso Tara",
      fields: [
        { label: "PESO BRUTO CAJA", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Peso Caja (Tapa / fondo)", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Peso Plástico", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Peso Plástico - Fundas VP - Peso Unid.", type: "calculated", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "[FUNDA VP: PESO UND. (ONZ)] / 16" },
        { label: "Peso Plástico - Fundas VP - Cant.", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Peso Plástico - Bolsas Master - Peso Unid.", type: "calculated", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "[TIPO EMPAQUE - CAJA (LBS)] / [TIPO EMPAQUE - FUNDA MASTER (LBS)]" },
        { label: "Peso Plástico - Bolsas Master - Cant.", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "GLASEO % - Requerido Mín.", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "GLASEO % - Requerido Máx.", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "GLASEO % - Cálculo %", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Peso Glaseo", type: "calculated", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "([GLASEO: PORCENTAJE] / 100) * [TIPO EMPAQUE - CAJA (LBS)]" },
        { label: "Peso total Fundas VP", type: "calculated", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "[Peso Plástico - Fundas VP - Peso Unid.] * [Peso Plástico - Fundas VP - Cant.]" },
        { label: "Peso total Bolsas Master", type: "calculated", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "[Peso Plástico - Bolsas Master - Peso Unid.] * [Peso Plástico - Bolsas Master - Cant.]" },
        { label: "PESO TOTAL TARA", type: "calculated", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "[Peso Caja (Tapa / fondo)] + [Peso Plástico] + [Peso total Fundas VP] + [Peso total Bolsas Master] + [Peso Glaseo]" },
        { label: "PESO NETO CAJA", type: "calculated", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "[PESO BRUTO CAJA] - [PESO TOTAL TARA]" },
      ],
    },

    // INGRESO DE DATOS PORCIONES
    {
      id: Date.now() + 1102,
      type: "table",
      title: "INGRESO DE DATOS PORCIONES (Pesos netos en oz)",
      defaultRows: 0,
      autoSumColumns: true, // Esto creará automáticamente la fila de TOTAL
      columns: [
        { label: "N°", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        ...bolsaColumns
      ],
      predefinedRows: porcionesRows,
    },

    // PESOS NETOS PORCIONES (Restando FUNDA VP)
    {
      id: Date.now() + 1105,
      type: "table",
      title: "PESOS NETOS PORCIONES (Cálculo Automático)",
      defaultRows: 0,
      columns: [
        { label: "N°", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        ...Array.from({ length: 10 }, (_, i) => ({
          label: `B. NETO ${i + 1}`,
          type: "calculated",
          required: false,
          options: [],
          apiMap: "",
          apiEndpoint: "",
          formula: `[BOLSA ${i + 1}] ? (([BOLSA ${i + 1}] - [FUNDA VP: PESO UND. (ONZ)]) / (([GLASEO: PORCENTAJE] / 100) + 1)) : ""`
        }))
      ],
      predefinedRows: Array.from({ length: 12 }, (_, r) => {
        const row = { "N°": (r + 1).toString(), _rowSpan: {}, _hidden: {} };
        for (let b = 1; b <= 10; b++) {
          row[`B. NETO ${b}`] = "";
        }
        return row;
      }),
    },

    // Resumen Totales Porciones
    {
      id: Date.now() + 1106,
      type: "section",
      title: "Resumen Totales",
      fields: [
        { label: "Sumatoria Pesos Netos (LBS)", type: "calculated", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "( (([BOLSA 1[*]] - ([FUNDA VP: PESO UND. (ONZ)] * [BOLSA 1[count]])) + ([BOLSA 2[*]] - ([FUNDA VP: PESO UND. (ONZ)] * [BOLSA 2[count]])) + ([BOLSA 3[*]] - ([FUNDA VP: PESO UND. (ONZ)] * [BOLSA 3[count]])) + ([BOLSA 4[*]] - ([FUNDA VP: PESO UND. (ONZ)] * [BOLSA 4[count]])) + ([BOLSA 5[*]] - ([FUNDA VP: PESO UND. (ONZ)] * [BOLSA 5[count]])) + ([BOLSA 6[*]] - ([FUNDA VP: PESO UND. (ONZ)] * [BOLSA 6[count]])) + ([BOLSA 7[*]] - ([FUNDA VP: PESO UND. (ONZ)] * [BOLSA 7[count]])) + ([BOLSA 8[*]] - ([FUNDA VP: PESO UND. (ONZ)] * [BOLSA 8[count]])) + ([BOLSA 9[*]] - ([FUNDA VP: PESO UND. (ONZ)] * [BOLSA 9[count]])) + ([BOLSA 10[*]] - ([FUNDA VP: PESO UND. (ONZ)] * [BOLSA 10[count]]))) / (([GLASEO: PORCENTAJE] / 100) + 1) ) / 16" },
        { label: "PESO NETO CAJA (LBS)", type: "calculated", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "[PESO BRUTO CAJA] - [PESO TOTAL TARA]" },
        { label: "PESO BRUTO CAJA (TEÓRICO)", type: "calculated", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "[Sumatoria Pesos Netos (LBS)] + [PESO TOTAL TARA]" },
      ],
    },

    // MÁXIMOS Y MÍNIMOS
    {
      id: Date.now() + 1103,
      type: "table",
      title: "MÁXIMOS Y MÍNIMOS - PESO NETO",
      defaultRows: 0,
      columns: [
        { label: "Métrica", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        ...bolsaColumnsCalculadas.map(col => ({
          ...col,
          formula: col.formula.replace(/\[GLASEO % - Cálculo %\]/g, "[GLASEO: PORCENTAJE]")
        }))
      ],
      predefinedRows: [
        { "Métrica": "MÁXIMO", "BOLSA 1": "", "BOLSA 2": "", "BOLSA 3": "", "BOLSA 4": "", "BOLSA 5": "", "BOLSA 6": "", "BOLSA 7": "", "BOLSA 8": "", "BOLSA 9": "", "BOLSA 10": "", _rowSpan: {}, _hidden: {} },
        { "Métrica": "MÍNIMO", "BOLSA 1": "", "BOLSA 2": "", "BOLSA 3": "", "BOLSA 4": "", "BOLSA 5": "", "BOLSA 6": "", "BOLSA 7": "", "BOLSA 8": "", "BOLSA 9": "", "BOLSA 10": "", _rowSpan: {}, _hidden: {} },
        { "Métrica": "COEF. UNIF.", "BOLSA 1": "", "BOLSA 2": "", "BOLSA 3": "", "BOLSA 4": "", "BOLSA 5": "", "BOLSA 6": "", "BOLSA 7": "", "BOLSA 8": "", "BOLSA 9": "", "BOLSA 10": "", _rowSpan: {}, _hidden: {} },
      ],
    },
    
    // GLASEO Y FUNDA VP
    {
      id: Date.now() + 1104,
      type: "section",
      title: "Glaseo y Funda VP",
      fields: [
        { label: "GLASEO: PESO C/GLASEO", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "GLASEO: PESO S/GLASEO", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "GLASEO: PORCENTAJE", type: "calculated", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "(([GLASEO: PESO C/GLASEO] - [GLASEO: PESO S/GLASEO]) / [GLASEO: PESO C/GLASEO]) * 100" },
        { label: "FUNDA VP: PESO UND. (ONZ)", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },

    // Evaluación Física
    {
      id: Date.now() + 1105,
      type: "table",
      title: "Evaluación Física",
      defaultRows: 1,
      columns: [
        { label: "Mala limpieza", type: "checkbox", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Honeycombing", type: "checkbox", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Parásitos", type: "checkbox", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Hematomas", type: "checkbox", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Restos de Piel", type: "checkbox", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Restos de plástico", type: "checkbox", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Bordes irregulares", type: "checkbox", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Deshidratación", type: "checkbox", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Piezas con Pesos fuera de especif.", type: "checkbox", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Piezas con medida fuera de especif.", type: "checkbox", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Color uniforme", type: "checkbox", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Material extraño", type: "checkbox", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },

    // Evaluación Organoléptica
    {
      id: Date.now() + 1106,
      type: "table",
      title: "Evaluación Organoléptica",
      defaultRows: 1,
      columns: [
        { label: "Olor crudo", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Olor cocinado", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Sabor cocinado", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Textura", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Color (línea de sangre)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },

    // Análisis Químico
    {
      id: Date.now() + 1107,
      type: "table",
      title: "Análisis Químico",
      defaultRows: 1,
      columns: [
        { label: "HISTAMINA", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "M#1 ppm", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "M#2 ppm", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "M#3 ppm", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },

    // Observación
    {
      id: Date.now() + 1108,
      type: "observaciones",
      title: "Observación",
    },

    // Evidencia Fotográfica (Anexo)
    {
      id: Date.now() + 1109,
      type: "section",
      title: "Evidencia Fotográfica (Anexo)",
      fields: [
        { label: "Evidencia Fotográfica 1", type: "image", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Evidencia Fotográfica 2", type: "image", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Evidencia Fotográfica 3", type: "image", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },
  ]

  const firmas = [
    {
      puesto: "Analista C. Calidad",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
    {
      puesto: "Jefe Aseg. de Calidad - Revisión",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
  ]

  return {
    codigo: "FOR-CC-40",
    nombre: "Monitoreo-Verificación de Especificaciones de Productos Terminados",
    version: "1",
    fechaVersion: "2025-04-14T00:00:00Z",
    supervisa: "Proceso - Productivo",
    proceso: "Control de Calidad - Productos Terminados",
    cuandoSeUsa: "Para monitorear y verificar especificaciones de productos terminados",
    quienLoLlena: "Analista C. Calidad",
    frecuencia: "Por muestreo",
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
// PLANTILLA: FOR-CC-41 - CONTROL / VERIFICACIÓN DIARIA DE
// LOS TERMÓMETROS
// Versión: 1 | Fecha: 11/09/2025
// ============================================================
function getVerificacionTermometrosTemplate() {
  const headerFields = [
    { label: "Fecha", type: "date", required: true, options: [], apiMap: "", apiEndpoint: "" },
    { label: "N° de Certificado de Calibración", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "" },
    { label: "Temp. Ref. del Equipo Patrón", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "" },
  ]

  // 8 grupos de termómetros, cada uno con sub-ítems
  const gruposTermometros = []
  for (let g = 1; g <= 8; g++) {
    const subItems = [
      "Termómetro",
      "Infrarrojo",
      "Digital",
      "Bimetálico",
    ]
    subItems.forEach((sub) => {
      gruposTermometros.push({
        "EQUIPO / IDENTIFICACIÓN": `Grupo ${g} - ${sub}`,
        "CÓDIGO / SERIE": "",
        "FRÍA / COLD - PATRÓN": "",
        "FRÍA / COLD - TERMÓMETRO": "",
        "FRÍA / COLD - DIFERENCIA °C": "",
        "FRÍA / COLD - CUMPLE TOLERANCIA (±1°C)": "",
        "AMBIENTAL / ENVIRONMENTAL - PATRÓN": "",
        "AMBIENTAL / ENVIRONMENTAL - TERMÓMETRO": "",
        "AMBIENTAL / ENVIRONMENTAL - DIFERENCIA °C": "",
        "AMBIENTAL / ENVIRONMENTAL - CUMPLE TOLERANCIA (±1°C)": "",
        "CALIENTE / HOT - PATRÓN": "",
        "CALIENTE / HOT - TERMÓMETRO": "",
        "CALIENTE / HOT - DIFERENCIA °C": "",
        "CALIENTE / HOT - CUMPLE (±0.5°C)": "",
        _rowSpan: {}, _hidden: {},
      })
    })
  }

  const bodyElements = [
    {
      id: Date.now() + 1200,
      type: "table",
      title: "Verificación Diaria de Termómetros",
      defaultRows: 0,
      columns: [
        { label: "EQUIPO / IDENTIFICACIÓN", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "CÓDIGO / SERIE", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "FRÍA / COLD - PATRÓN", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "FRÍA / COLD" },
        { label: "FRÍA / COLD - TERMÓMETRO", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "FRÍA / COLD" },
        { label: "FRÍA / COLD - DIFERENCIA °C", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "FRÍA / COLD" },
        { label: "FRÍA / COLD - CUMPLE TOLERANCIA (±1°C)", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "", group: "FRÍA / COLD" },
        { label: "AMBIENTAL / ENVIRONMENTAL - PATRÓN", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "AMBIENTAL" },
        { label: "AMBIENTAL / ENVIRONMENTAL - TERMÓMETRO", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "AMBIENTAL" },
        { label: "AMBIENTAL / ENVIRONMENTAL - DIFERENCIA °C", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "AMBIENTAL" },
        { label: "AMBIENTAL / ENVIRONMENTAL - CUMPLE TOLERANCIA (±1°C)", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "", group: "AMBIENTAL" },
        { label: "CALIENTE / HOT - PATRÓN", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "CALIENTE / HOT" },
        { label: "CALIENTE / HOT - TERMÓMETRO", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "CALIENTE / HOT" },
        { label: "CALIENTE / HOT - DIFERENCIA °C", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "CALIENTE / HOT" },
        { label: "CALIENTE / HOT - CUMPLE (±0.5°C)", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "", group: "CALIENTE / HOT" },
      ],
      predefinedRows: gruposTermometros,
    },

    // Observaciones
    {
      id: Date.now() + 1201,
      type: "observaciones",
      title: "Observaciones",
    },

    // Acciones Correctivas
    {
      id: Date.now() + 1202,
      type: "section",
      title: "Acciones Correctivas",
      fields: [
        { label: "Acciones Correctivas", type: "textarea", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },
  ]

  const firmas = [
    {
      puesto: "Elaborado por - Aseguramiento de Calidad",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
    {
      puesto: "Revisado por - Jefe Aseguramiento de Calidad",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
  ]

  return {
    codigo: "FOR-CC-41",
    nombre: "Control / Verificación Diaria de los Termómetros",
    version: "1",
    fechaVersion: "2025-09-11T00:00:00Z",
    supervisa: "Proceso - Productivo",
    proceso: "Control de Calidad - Verificación de Equipos",
    cuandoSeUsa: "Para verificar diariamente la calibración de los termómetros",
    quienLoLlena: "Aseguramiento de Calidad",
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
// PLANTILLA: FOR-CC-5 - CONTROL DE LA CONTAMINACIÓN CON
// VIDRIOS Y MATERIALES QUEBRADIZOS
// Versión: 6 | Fecha: 29/09/2025
// ============================================================
function getControlVidriosQuebradizosTemplate() {
  const headerFields = [
    { label: "Fecha", type: "date", required: true, options: [], apiMap: "", apiEndpoint: "" },
  ]

  const areas = {
    "Sala de proceso (Área de Fileteo - Corte - Clasificación y Empaque)": [
      { tipo: "Protectores de luminarias (acrílico)", cantidad: "de 116" },
      { tipo: "Protectores de luminarias redondas", cantidad: "de 4" },
      { tipo: "Protector de lámparas de emergencia", cantidad: "de 7" },
      { tipo: "Bulbos insectocapadores UV (antisalillas)", cantidad: "de 10" },
      { tipo: "Lente de cámara de videovigilancia", cantidad: "de 4" },
      { tipo: "Lente de cámara de vigilancia (pasillo escolla bodega)", cantidad: "de 1" },
      { tipo: "Alarma (incendio)", cantidad: "de 1" },
      { tipo: "Protectores de luminarias (pasillo escolla bodega)", cantidad: "de 2" },
      { tipo: "Protector de tablero de mando detector de metales", cantidad: "de 1" },
      { tipo: "Baliza (alarma) detector de metales", cantidad: "de 1" },
      { tipo: "Baliza (alarma) máquina clasif. Cam.", cantidad: "de 1" },
      { tipo: "Pantallas video jet", cantidad: "de 3" },
      { tipo: "Pantallas máquinas clasificadoras Marel/c", cantidad: "de 2" },
      { tipo: "Kit de medición de presión (Máq. Marel/c)", cantidad: "de 2" },
      { tipo: "Cobertores de sellado (Máq. VC999)", cantidad: "de 4" },
      { tipo: "Panel superior (cortina de ingreso a proceso)", cantidad: "de 1" },
      { tipo: "Ventanas (protección antisatélite)", cantidad: "de 2" },
      { tipo: "Puerta (entrada al laboratorio)", cantidad: "de 1" },
      { tipo: "Pantallas Máq. VC999", cantidad: "de 2" },
      { tipo: "Reloj de pared", cantidad: "de 1" },
      { tipo: "Protector de lámpara (zona de inspección de producto C. Calidad)", cantidad: "de 1" },
      { tipo: "Baliza roja (Alarma de emergencia)", cantidad: "de 1" },
      { tipo: "Etiquetas de Acrílico (voltaje)", cantidad: "de 38" },
      { tipo: "Porta hojas de acrílico (C. Calidad)", cantidad: "de 5" },
    ],
    "Cámara de refrigeración": [
      { tipo: "Protectores de luminarias", cantidad: "de 1" },
      { tipo: "Protectores de luminarias", cantidad: "de 12" },
    ],
    "Área de CO": [
      { tipo: "Lámparas de emergencia", cantidad: "de 1" },
      { tipo: "Manómetros", cantidad: "de 4" },
    ],
    "Protúnel": [
      { tipo: "Protectores de luminarias (acrílico)", cantidad: "de 8" },
    ],
    "Túnel (1, 2, 3, 4)": [
      { tipo: "Protectores de luminarias (acrílico)", cantidad: "de 8" },
    ],
    "Cám. Alm. Prod. Cong.": [
      { tipo: "Protectores de luminarias", cantidad: "de 32" },
      { tipo: "Lente de cámara de videovigilancia", cantidad: "de 2" },
      { tipo: "Lámparas de emergencia", cantidad: "de 2" },
      { tipo: "Protectores de luminarias", cantidad: "de 24" },
      { tipo: "Pantalla laptop", cantidad: "de 1" },
      { tipo: "Protector acrílico para laptop Recep. MP", cantidad: "de 1" },
    ],
    "Recepción de Materia Prima": [
      { tipo: "Bulbos insectocapadores UV (antisalillas)", cantidad: "de 6" },
      { tipo: "Protector de enchufe de acrílico", cantidad: "de 2" },
      { tipo: "Puerta", cantidad: "de 1" },
      { tipo: "Paneles de la cabina", cantidad: "de 1" },
    ],
    "Cabina - Oficina Superv. Recep. MP.": [
      { tipo: "Ventana pequeña", cantidad: "de 1" },
      { tipo: "Protector de lámpara para mesa de calibración de producto", cantidad: "de 1" },
      { tipo: "Protectores de luminarias", cantidad: "de 1" },
    ],
    "Área de almacenamiento de hielo": [
      { tipo: "Lámparas de emergencia", cantidad: "de 1" },
      { tipo: "Protectores de luminarias", cantidad: "de 2" },
      { tipo: "Vidrio de cabina \u2013 Oficina", cantidad: "de 1" },
      { tipo: "Pantalla laptop", cantidad: "de 1" },
      { tipo: "Protector impresora", cantidad: "de 1" },
    ],
    "Área de proceso a2": [
      { tipo: "Lámparas de emergencia", cantidad: "de 1" },
      { tipo: "Etiquetas de Acrílico (voltaje)", cantidad: "de 13" },
      { tipo: "Protectores de luminarias", cantidad: "de 6" },
      { tipo: "Bulbos insectocapadores UV (antisalillas)", cantidad: "de 8" },
      { tipo: "Protector de lámpara de emergencia", cantidad: "de 1" },
    ],
    "Salida subproductos": [
      { tipo: "Protectores de luminaria", cantidad: "de 2" },
      { tipo: "Bulbos insectocapadores UV (antisalillas)", cantidad: "de 2" },
    ],
  }

  const predefinedRows = []
  Object.entries(areas).forEach(([areaName, items]) => {
    items.forEach((item, idx) => {
      predefinedRows.push({
        "AREA/UBICACIÓN": idx === 0 ? areaName : "",
        "TIPO": item.tipo,
        "CANTIDAD VERIFICADAS": item.cantidad,
        "PRESENTA FISURAS/OTRO RIESGO?": "",
        "OBSERVACIONES": "",
        _rowSpan: idx === 0 ? { "AREA/UBICACIÓN": items.length } : {},
        _hidden: idx > 0 ? { "AREA/UBICACIÓN": true } : {},
      })
    })
  })

  const bodyElements = [
    {
      id: Date.now() + 1300,
      type: "table",
      title: "Listado de Elementos Quebradizo",
      defaultRows: 0,
      columns: [
        { label: "AREA/UBICACIÓN", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "TIPO", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "CANTIDAD VERIFICADAS", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "PRESENTA FISURAS/OTRO RIESGO?", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "", group: "VERIFICACIÓN" },
        { label: "OBSERVACIONES", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "VERIFICACIÓN" },
      ],
      predefinedRows: predefinedRows,
    },
    {
      id: Date.now() + 1301,
      type: "observaciones",
      title: "Observaciones",
    },
    {
      id: Date.now() + 1302,
      type: "section",
      title: "Acciones Correctivas",
      fields: [
        { label: "Acciones Correctivas", type: "textarea", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },
  ]

  const firmas = [
    {
      puesto: "Elaborado por - Analista de Calidad",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
    {
      puesto: "Revisión - Aseguramiento De Calidad",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
  ]

  return {
    codigo: "FOR-CC-5",
    nombre: "Control de la Contaminación con Vidrios y Materiales Quebradizos",
    version: "6",
    fechaVersion: "2025-09-29T00:00:00Z",
    supervisa: "Proceso - Productivo",
    proceso: "Control de Calidad - Contaminación Física",
    cuandoSeUsa: "Para verificar el estado de vidrios y materiales quebradizos en todas las áreas",
    quienLoLlena: "Analista de Calidad",
    frecuencia: "Periódica",
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
// PLANTILLA: FOR-CC-8 - INSPECCIÓN DE MATERIALES DE EMPAQUE
// DURANTE LA RECEPCIÓN
// Versión: 1 | Fecha: 18/02/2025
// ============================================================
function getInspeccionMaterialesEmpaqueTemplate() {
  const headerFields = [
    { label: "Fecha - Hora", type: "datetime-local", required: true, options: [], apiMap: "", apiEndpoint: "" },
  ]

  const bodyElements = [
    // Tipo de material
    {
      id: Date.now() + 1400,
      type: "section",
      title: "Tipo de Material",
      fields: [
        {
          label: "Seleccione tipo de material",
          type: "checkbox",
          required: false,
          options: [
            "Cajas de cartón/empaque",
            "Caja de cartón",
            "Rollo de fundas (plástico)",
            "Fundas de plástico (varios tamaños)",
            "Fundas litografiadas",
            "Láminas FOAM",
            "Etiquetas (vaso)",
          ],
          apiMap: "",
          apiEndpoint: "",
          formula: "",
        },
      ],
    },

    // Detalle del producto
    {
      id: Date.now() + 1401,
      type: "section",
      title: "Detalle del Producto",
      fields: [
        { label: "Producto", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Proveedor", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Entrega a Dpt. Calidad", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Vehículo (Placa)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },

    // Inspección General
    {
      id: Date.now() + 1402,
      type: "table",
      title: "Inspección General",
      defaultRows: 2,
      columns: [
        { label: "TIPO DE TRANSPORTE", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "FUNCIÓN", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "CONTENEDOR", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "CONDICIÓN ÓPTIMA TRANSPORTE SI/NO", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "PROTECCIÓN DEL MATERIAL", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "CAJA DE CARTÓN PUERTA CORRECTA SI/NO", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },

    // Transporte seguro
    {
      id: Date.now() + 1403,
      type: "section",
      title: "Condiciones de Transporte",
      fields: [
        { label: "TRANSPORTE SEGURO CONTRA POLVO Y HUMEDAD", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "DOCUMENTO DE PLACAS TRANSPORTE", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "DAÑO DEL MATERIAL POR MAL ESTIBA U OTROS (Especif.)", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },

    // Inspección Específica - Detalle del Material
    {
      id: Date.now() + 1404,
      type: "table",
      title: "Inspección Específica - Detalle del Material",
      defaultRows: 4,
      columns: [
        { label: "LOTE / O.P", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Detalle del Material" },
        { label: "CANTIDAD (Tamaño del Lote) BULTOS/ROLLOS", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Detalle del Material" },
        { label: "UNIDADES", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Detalle del Material" },
        { label: "TOTAL INSPECCIÓN (Tamaño muestra) BULTOS/ROLLOS", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Detalle del Material" },
        { label: "UNIDADES (muestra)", type: "number", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", group: "Detalle del Material" },
      ],
    },

    // Inspección Específica - Parámetros
    {
      id: Date.now() + 1405,
      type: "table",
      title: "Inspección Específica - Parámetros de Inspección",
      defaultRows: 0,
      columns: [
        { label: "PARÁMETRO DE INSPECCIÓN", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "LOTE #1 SI/NO", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "", group: "Resultados" },
        { label: "LOTE #2 SI/NO", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "", group: "Resultados" },
        { label: "LOTE #3 SI/NO", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "", group: "Resultados" },
        { label: "LOTE #4 SI/NO", type: "select", required: false, options: ["SI", "NO"], apiMap: "", apiEndpoint: "", formula: "", group: "Resultados" },
      ],
      predefinedRows: [
        { "PARÁMETRO DE INSPECCIÓN": "PROTECCIÓN INSP. DE LOS MATERIALES EN BUEN ESTADO", "LOTE #1 SI/NO": "", "LOTE #2 SI/NO": "", "LOTE #3 SI/NO": "", "LOTE #4 SI/NO": "", _rowSpan: {}, _hidden: {} },
        { "PARÁMETRO DE INSPECCIÓN": "DIMENSIONES CORRECTAS", "LOTE #1 SI/NO": "", "LOTE #2 SI/NO": "", "LOTE #3 SI/NO": "", "LOTE #4 SI/NO": "", _rowSpan: {}, _hidden: {} },
        { "PARÁMETRO DE INSPECCIÓN": "ESTIRONES RESISTENTE AL INTENTO DE DESPRENDIMIENTO (CAJAS/FUNDAS)", "LOTE #1 SI/NO": "", "LOTE #2 SI/NO": "", "LOTE #3 SI/NO": "", "LOTE #4 SI/NO": "", _rowSpan: {}, _hidden: {} },
        { "PARÁMETRO DE INSPECCIÓN": "PARTÍCULAS EXTRAÑAS", "LOTE #1 SI/NO": "", "LOTE #2 SI/NO": "", "LOTE #3 SI/NO": "", "LOTE #4 SI/NO": "", _rowSpan: {}, _hidden: {} },
        { "PARÁMETRO DE INSPECCIÓN": "IMPUREZAS", "LOTE #1 SI/NO": "", "LOTE #2 SI/NO": "", "LOTE #3 SI/NO": "", "LOTE #4 SI/NO": "", _rowSpan: {}, _hidden: {} },
        { "PARÁMETRO DE INSPECCIÓN": "GOLPES", "LOTE #1 SI/NO": "", "LOTE #2 SI/NO": "", "LOTE #3 SI/NO": "", "LOTE #4 SI/NO": "", _rowSpan: {}, _hidden: {} },
        { "PARÁMETRO DE INSPECCIÓN": "OLORES EXTRAÑOS", "LOTE #1 SI/NO": "", "LOTE #2 SI/NO": "", "LOTE #3 SI/NO": "", "LOTE #4 SI/NO": "", _rowSpan: {}, _hidden: {} },
        { "PARÁMETRO DE INSPECCIÓN": "PINZAS / ARRUGAS (if apply)", "LOTE #1 SI/NO": "", "LOTE #2 SI/NO": "", "LOTE #3 SI/NO": "", "LOTE #4 SI/NO": "", _rowSpan: {}, _hidden: {} },
        { "PARÁMETRO DE INSPECCIÓN": "ROLLO MAL REBOBINADO (if apply)", "LOTE #1 SI/NO": "", "LOTE #2 SI/NO": "", "LOTE #3 SI/NO": "", "LOTE #4 SI/NO": "", _rowSpan: {}, _hidden: {} },
      ],
    },

    // Espesor plástico
    {
      id: Date.now() + 1406,
      type: "section",
      title: "Espesor de Plástico",
      fields: [
        { label: "# DE ROLLO / ESPESOR DE PLÁSTICO mm - μm", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },

    // Plan de muestreo
    {
      id: Date.now() + 1407,
      type: "table",
      title: "Tabla #1: PLAN DE MUESTREO PARA EVALUAR REQUISITOS GENERALES",
      defaultRows: 0,
      columns: [
        { label: "Tamaño Lote (Cantidad)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Tamaño Muestra (Un)", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Aceptación", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "Rechazo", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
      predefinedRows: [
        { "Tamaño Lote (Cantidad)": "2 - 8", "Tamaño Muestra (Un)": "2", "Aceptación": "0", "Rechazo": "1", _rowSpan: {}, _hidden: {} },
        { "Tamaño Lote (Cantidad)": "9 - 15", "Tamaño Muestra (Un)": "2", "Aceptación": "0", "Rechazo": "1", _rowSpan: {}, _hidden: {} },
        { "Tamaño Lote (Cantidad)": "16 - 50", "Tamaño Muestra (Un)": "3", "Aceptación": "0", "Rechazo": "1", _rowSpan: {}, _hidden: {} },
        { "Tamaño Lote (Cantidad)": "51 - 150", "Tamaño Muestra (Un)": "5", "Aceptación": "0", "Rechazo": "1", _rowSpan: {}, _hidden: {} },
        { "Tamaño Lote (Cantidad)": "151 - 500", "Tamaño Muestra (Un)": "8", "Aceptación": "0", "Rechazo": "1", _rowSpan: {}, _hidden: {} },
      ],
    },

    // Criterio de aceptación
    {
      id: Date.now() + 1408,
      type: "section",
      title: "Criterio de aceptación",
      fields: [
        { label: "Criterio: Si el número de unidades defectuosas de la muestra es menor o igual al número de aceptación se aprueba el lote (siempre y cuando cumpla con los requisitos). Si el número de unidades defectuosas es mayor o igual al número de rechazo, el lote se rechaza.", type: "label", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
        { label: "NTE INEN ISO 2859-1", type: "label", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" },
      ],
    },

    // Comentarios Generales
    {
      id: Date.now() + 1409,
      type: "observaciones",
      title: "Comentarios Generales",
    },
  ]

  const firmas = [
    {
      puesto: "Inspeccionado por - Supervisor Aseg. De Calidad",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
    {
      puesto: "Revisado por - Bodeguero",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
    {
      puesto: "Revisión - Aseguramiento de Calidad",
      nombreCompleto: "",
      capturaFecha: true,
      capturaHora: true,
      reemplazos: [],
      jefeAlerta: [],
    },
  ]

  return {
    codigo: "FOR-CC-8",
    nombre: "Inspección de Materiales de Empaque Durante la Recepción",
    version: "1",
    fechaVersion: "2025-02-18T00:00:00Z",
    supervisa: "Proceso - Productivo",
    proceso: "Control de Calidad - Recepción de Materiales",
    cuandoSeUsa: "Durante la recepción de materiales de empaque",
    quienLoLlena: "Supervisor Aseg. De Calidad",
    frecuencia: "Por recepción",
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
    {
      key: "detector-metal",
      label: "Registro Calibración y Desafío del Detector de Metal (PCC)",
      code: "FOR-CC-16",
      getData: getDetectorMetalTemplate,
      icon: "🔍",
    },
    {
      key: "control-agua",
      label: "Control del Agua en Proceso (Clorinación y Peroxiacético) - DUPLICADO",
      code: "FOR-CC-18-B",
      getData: getControlAguaTemplate,
      icon: "💧",
    },
    {
      key: "almacenamiento-refrigerado",
      label: "Control de Almacenamiento Refrigerado de Producto con CO (PCC)",
      code: "FOR-CC-21",
      getData: getAlmacenamientoRefrigeradoTemplate,
      icon: "❄️",
    },
    {
      key: "inspeccion-areas-no-productivas",
      label: "Lista de Inspección Sanitaria de Áreas No Productivas",
      code: "FOR-CC-34",
      getData: getInspeccionAreasNoProductivasTemplate,
      icon: "🏭",
    },
    {
      key: "limpieza-tanques-tinas",
      label: "Registro de Limpieza de Tanques y Tinas",
      code: "FOR-CC-36",
      getData: getLimpiezaTanquesTinasTemplate,
      icon: "🪣",
    },
    {
      key: "inspeccion-sanitaria-areas",
      label: "Inspección de Condiciones Sanitarias de las Áreas de Proceso",
      code: "FOR-CC-4",
      getData: getInspeccionSanitariaAreasTemplate,
      icon: "🔬",
    },
    {
      key: "verificacion-balanzas",
      label: "Verificación de Balanzas",
      code: "FOR-CC-38",
      getData: getVerificacionBalanzasTemplate,
      icon: "⚖️",
    },
    {
      key: "empaque-final",
      label: "Control de Empaque Final",
      code: "FOR-CC-06",
      getData: getEmpaqueFinaTemplate,
      icon: "📦",
    },
    {
      key: "monitoreo-productos-terminados",
      label: "Monitoreo-Verificación de Especificaciones de Productos Terminados",
      code: "FOR-CC-40",
      getData: getMonitoreoProductosTerminadosTemplate,
      icon: "📦",
    },
    {
      key: "verificacion-termometros",
      label: "Control / Verificación Diaria de los Termómetros",
      code: "FOR-CC-41",
      getData: getVerificacionTermometrosTemplate,
      icon: "🌡️",
    },
    {
      key: "control-vidrios-quebradizos",
      label: "Control de la Contaminación con Vidrios y Materiales Quebradizos",
      code: "FOR-CC-5",
      getData: getControlVidriosQuebradizosTemplate,
      icon: "🪟",
    },
    {
      key: "inspeccion-materiales-empaque",
      label: "Inspección de Materiales de Empaque Durante la Recepción",
      code: "FOR-CC-8",
      getData: getInspeccionMaterialesEmpaqueTemplate,
      icon: "📥",
    },
  ]

  const createTemplate = async (templateDef) => {
    setLoading((prev) => ({ ...prev, [templateDef.key]: true }))
    setStatus((prev) => ({ ...prev, [templateDef.key]: null }))

    try {
      const payload = templateDef.getData()

      // Comprobar si ya existe una plantilla con este código
      const allRes = await fetch(`${API_URL}/all`)
      if (!allRes.ok) throw new Error("No se pudo obtener la lista de plantillas")
      
      let allTemplates = await allRes.json()
      
      // 🔧 Manejar posible envoltorio JSON ($values, data, etc.)
      if (!Array.isArray(allTemplates)) {
        allTemplates = allTemplates.$values || allTemplates.data || allTemplates.value || allTemplates.items || []
      }
      
      const existing = allTemplates.find(t => t.codigo === payload.codigo)

      let response;
      if (existing) {
        payload.templateID = existing.templateID
        response = await fetch(`${API_URL}/${existing.templateID}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Error ${response.status}: ${errorText}`)
      }

      let result = {}
      if (response.status !== 204) {
        result = await response.json()
      }
      
      setStatus((prev) => ({
        ...prev,
        [templateDef.key]: { success: true, message: `Plantilla ${existing ? 'actualizada' : 'creada'} exitosamente (ID: ${result.templateID || existing?.templateID || "OK"})` },
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
