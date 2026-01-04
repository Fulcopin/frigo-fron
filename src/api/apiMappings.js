// src/api/apiMappings.js

// Esta constante define qué campos de la API se pueden usar para mapear
// en la creación de plantillas.
export const MAPPABLE_API_FIELDS = {
  // Campos disponibles en la cabecera del movimiento (MovimientoPorId)
  header: [
    { value: "", label: "No aplica" }, // Opción para desvincular
    { value: "cabId", label: "ID Lote Principal (cabId)" },
    { value: "cabProveedor", label: "Proveedor" },
    { value: "cabPesquero", label: "Embarcación (Pesquero)" },
    { value: "cabPlaca", label: "Placa" },
    { value: "cabChofer", label: "Chofer" },
    { value: "cabCalificador", label: "Calificador" },
    { value: "cabSupervisor", label: "Supervisor" },
    { value: "cabGuiaRemision", label: "Guía de Remisión" },
    { value: "cabLugarDesembarque", label: "Lugar de Desembarque" },
    { value: "cabFecha", label: "Fecha del Movimiento" },
    { value: "cabEstado", label: "Estado" },
    { value: "cabTipo", label: "Tipo de Movimiento" },
    { value: "cabAyudante", label: "Ayudante" },
    { value: "cabEnhielador", label: "Enhielador" },
  ],
  // 🆕 CATÁLOGOS DE API EXTERNA (usar con apiEndpoint, no apiMap)
  catalogs: [
    { value: "", label: "No aplica" },
    { value: "BALANZAS", label: "🔧 Balanzas (Catálogo)" },
    { value: "CHOFERES", label: "👤 Choferes (Catálogo)" },
    { value: "ESPECIES", label: "🐟 Especies (Catálogo)" },
    { value: "PESQUEROS", label: "🚢 Pesqueros (Catálogo)" },
    { value: "PRODUCTOS", label: "📦 Productos (Catálogo)" },
    { value: "PROVEEDORES", label: "🏢 Proveedores (Catálogo)" },
    { value: "CONFIGURACIONES", label: "⚙️ Configuraciones (Catálogo)" },
    { value: "CONFIGURACIONES_FRIGO", label: "❄️ Configuraciones FRIGO (Catálogo)" },
    // 🆕 Catálogos de Calidad Sensorial
    { value: "PIEL", label: "🐠 Piel (Calidad)" },
    { value: "DUREZA", label: "💪 Dureza (Calidad)" },
    { value: "CAVIDAD_VENTRAL", label: "🫁 Cavidad Ventral (Calidad)" },
    { value: "OLOR", label: "👃 Olor (Calidad)" },
    { value: "SABOR_CARNE", label: "👅 Sabor de Carne (Calidad)" },
    { value: "OJOS_CLARIDAD", label: "👁️ Claridad de Ojos (Calidad)" },
    { value: "OJOS_FORMA", label: "👁️ Forma de Ojos (Calidad)" },
    { value: "BRANQUIAS_COLOR", label: "🎨 Color de Branquias (Calidad)" },
    { value: "BRANQUIAS_OLOR", label: "👃 Olor de Branquias (Calidad)" },
  ],
  // Campos disponibles en los detalles del movimiento (MovimientoDetallesPorId)
  // Estos se usarán para las columnas de las tablas.
  details: [
    { value: "", label: "No aplica" },
    { value: "detId", label: "ID Detalle (detId)" },
    { value: "detCabId", label: "ID Lote Principal (detCabId)" },
    { value: "detCodigo", label: "Lote de Proceso (detCodigo)" },
    { value: "detEspecie", label: "🐟 Especie" },
    { value: "detProducto", label: "📦 Producto" },
    { value: "detTipoTina", label: "🧊 Tipo de Tina" },
    { value: "detNumeroPiezaTina", label: "🔢 Número Pieza/Tina" },
    { value: "detCodigoErpProducto", label: "🏷️ Código ERP Producto" },
    { value: "detTipoControl", label: "✅ Tipo de Control" },
    { value: "detTemperatura", label: "🌡️ Temperatura" },
    { value: "detCantidadPiezas", label: "📊 Cantidad de Piezas" },
    { value: "detCajas", label: "📦 Número de Cajas" },
    { value: "detPesoTara", label: "⚖️ Peso Tara" },
    { value: "detPesoBrutoBalanza", label: "⚖️ Peso Bruto Balanza" },
    { value: "detPesoNetoBalanza", label: "⚖️ Peso Neto Balanza" },
    { value: "detPesoRomaneo", label: "⚖️ Peso Romaneo" },
    // Campos con prefijo "_" (combinados)
    { value: "_loteNumero", label: "🔢 Número de Lote (_loteNumero)" },
    { value: "_loteProveedor", label: "🏢 Proveedor del Lote (_loteProveedor)" },
    { value: "_cabProveedor", label: "🏢 Proveedor (_cabProveedor)" },
    { value: "_cabPesquero", label: "🚢 Pesquero (_cabPesquero)" },
    { value: "_cabPlaca", label: "🚗 Placa (_cabPlaca)" },
    { value: "_cabChofer", label: "👤 Chofer (_cabChofer)" },
    { value: "_cabCalificador", label: "✅ Calificador (_cabCalificador)" },
    { value: "_cabGuiaRemision", label: "📄 Guía Remisión (_cabGuiaRemision)" },
    { value: "_cabLugarDesembarque", label: "📍 Lugar Desembarque (_cabLugarDesembarque)" },
  ],
};