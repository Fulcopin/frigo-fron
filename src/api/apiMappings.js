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
  ],
  // Campos disponibles en los detalles del movimiento (MovimientoDetallesPorId)
  // Estos se usarán para las columnas de las tablas.
  details: [
    { value: "", label: "No aplica" },
    { value: "detCodigo", label: "Lote de Proceso (detCodigo)" },
    { value: "detEspecie", label: "Especie" },
    { value: "detProducto", label: "Producto" },
    { value: "detTipoTina", label: "Tipo de Tina" },
    { value: "detNumeroPiezaTina", label: "Número Pieza/Tina" },
    { value: "detCodigoErpProducto", label: "Código ERP Producto" },
  ],
};