# 🚀 Ejemplos Prácticos de Uso de APIs

## Ejemplo 1: Formulario de Recepción de Materia Prima

```json
{
  "templateID": 0,
  "codigo": "FOR-REC-MP-001",
  "nombre": "Recepción de Materia Prima",
  "version": "01-00",
  "proceso": "RECEPCIÓN",
  "headerFields": [
    {
      "label": "Fecha de Recepción",
      "name": "fecha",
      "type": "date",
      "required": true
    },
    {
      "label": "Proveedor",
      "name": "proveedor",
      "type": "select",
      "required": true,
      "apiEndpoint": "PROVEEDORES"
    },
    {
      "label": "Chofer",
      "name": "chofer",
      "type": "select",
      "required": true,
      "apiEndpoint": "CHOFERES"
    },
    {
      "label": "Embarcación",
      "name": "embarcacion",
      "type": "select",
      "required": true,
      "apiEndpoint": "PESQUEROS"
    }
  ],
  "bodyElements": [
    {
      "type": "table",
      "id": "tabla-recepcion",
      "title": "Detalle de Recepción",
      "columns": [
        {
          "label": "Especie",
          "header": "Especie",
          "name": "especie",
          "type": "select",
          "required": true,
          "apiEndpoint": "ESPECIES"
        },
        {
          "label": "Producto",
          "header": "Producto",
          "name": "producto",
          "type": "select",
          "required": true,
          "apiEndpoint": "PRODUCTOS"
        },
        {
          "label": "Peso Bruto (kg)",
          "header": "Peso Bruto (kg)",
          "name": "peso_bruto",
          "type": "number",
          "required": true
        },
        {
          "label": "Balanza Utilizada",
          "header": "Balanza",
          "name": "balanza",
          "type": "select",
          "required": true,
          "apiEndpoint": "BALANZAS"
        },
        {
          "label": "Temperatura (°C)",
          "header": "Temp. (°C)",
          "name": "temperatura",
          "type": "temperature",
          "required": true
        }
      ],
      "defaultRows": 10
    }
  ],
  "firmas": [
    {
      "puesto": "Responsable de Recepción"
    },
    {
      "puesto": "Supervisor de Calidad"
    }
  ]
}
```

**Campos con API:**
- ✅ Proveedor → Carga desde `/Proveedores`
- ✅ Chofer → Carga desde `/Choferes`
- ✅ Embarcación → Carga desde `/Pesqueros`
- ✅ Especie (tabla) → Carga desde `/Especies`
- ✅ Producto (tabla) → Carga desde `/Productos`
- ✅ Balanza (tabla) → Carga desde `/Balanzas`

---

## Ejemplo 2: Control de Temperatura de Frigoríficos

```json
{
  "templateID": 0,
  "codigo": "FOR-TEMP-FRIGO-001",
  "nombre": "Control de Temperatura de Frigoríficos",
  "version": "01-00",
  "proceso": "FRIGORÍFICO",
  "headerFields": [
    {
      "label": "Fecha",
      "name": "fecha",
      "type": "date",
      "required": true
    },
    {
      "label": "Responsable",
      "name": "responsable",
      "type": "text",
      "required": true
    }
  ],
  "bodyElements": [
    {
      "type": "table",
      "id": "tabla-frigorificos",
      "title": "Registro de Temperaturas",
      "columns": [
        {
          "label": "Hora",
          "header": "Hora",
          "name": "hora",
          "type": "time",
          "required": true
        },
        {
          "label": "Frigorífico",
          "header": "Frigorífico",
          "name": "frigorifico",
          "type": "select",
          "required": true,
          "apiEndpoint": "CONFIGURACIONES_FRIGO"
        },
        {
          "label": "Temperatura Registrada (°C)",
          "header": "Temp. Real (°C)",
          "name": "temperatura_real",
          "type": "temperature",
          "required": true
        },
        {
          "label": "Temperatura Objetivo (°C)",
          "header": "Temp. Objetivo (°C)",
          "name": "temperatura_objetivo",
          "type": "temperature",
          "required": true
        },
        {
          "label": "Estado",
          "header": "Estado",
          "name": "estado",
          "type": "select",
          "options": ["Conforme", "Fuera de Rango", "En Ajuste"],
          "required": true
        }
      ],
      "defaultRows": 8
    }
  ],
  "firmas": [
    {
      "puesto": "Operador de Frigorífico"
    },
    {
      "puesto": "Supervisor de Mantenimiento"
    }
  ]
}
```

**Campos con API:**
- ✅ Frigorífico → Carga solo configuraciones con "FRIGO" desde `/Configuraciones`

---

## Ejemplo 3: Registro de Despacho

```json
{
  "templateID": 0,
  "codigo": "FOR-DESP-001",
  "nombre": "Registro de Despacho",
  "version": "01-00",
  "proceso": "DESPACHO",
  "headerFields": [
    {
      "label": "Fecha de Despacho",
      "name": "fecha",
      "type": "date",
      "required": true
    },
    {
      "label": "Cliente",
      "name": "cliente",
      "type": "select",
      "required": true,
      "apiEndpoint": "PROVEEDORES"
    },
    {
      "label": "Chofer",
      "name": "chofer",
      "type": "select",
      "required": true,
      "apiEndpoint": "CHOFERES"
    },
    {
      "label": "Vehículo",
      "name": "vehiculo",
      "type": "text",
      "required": true
    }
  ],
  "bodyElements": [
    {
      "type": "table",
      "id": "tabla-despacho",
      "title": "Detalle de Productos Despachados",
      "columns": [
        {
          "label": "Producto",
          "header": "Producto",
          "name": "producto",
          "type": "select",
          "required": true,
          "apiEndpoint": "PRODUCTOS"
        },
        {
          "label": "Cantidad (Cajas)",
          "header": "Cajas",
          "name": "cantidad",
          "type": "number",
          "required": true
        },
        {
          "label": "Peso Neto (kg)",
          "header": "Peso (kg)",
          "name": "peso",
          "type": "number",
          "required": true
        },
        {
          "label": "Balanza Verificación",
          "header": "Balanza",
          "name": "balanza",
          "type": "select",
          "required": true,
          "apiEndpoint": "BALANZAS"
        }
      ],
      "defaultRows": 10
    }
  ],
  "firmas": [
    {
      "puesto": "Responsable de Despacho"
    },
    {
      "puesto": "Chofer (Recibido)"
    }
  ]
}
```

**Campos con API:**
- ✅ Cliente → Carga desde `/Proveedores`
- ✅ Chofer → Carga desde `/Choferes`
- ✅ Producto (tabla) → Carga desde `/Productos`
- ✅ Balanza (tabla) → Carga desde `/Balanzas`

---

## Ejemplo 4: Control de Calidad

```json
{
  "templateID": 0,
  "codigo": "FOR-CC-001",
  "nombre": "Control de Calidad de Producto",
  "version": "01-00",
  "proceso": "CALIDAD",
  "headerFields": [
    {
      "label": "Fecha de Inspección",
      "name": "fecha",
      "type": "date",
      "required": true
    },
    {
      "label": "Inspector",
      "name": "inspector",
      "type": "text",
      "required": true
    },
    {
      "label": "Proveedor",
      "name": "proveedor",
      "type": "select",
      "required": true,
      "apiEndpoint": "PROVEEDORES"
    }
  ],
  "bodyElements": [
    {
      "type": "table",
      "id": "tabla-calidad",
      "title": "Evaluación de Calidad",
      "columns": [
        {
          "label": "Especie",
          "header": "Especie",
          "name": "especie",
          "type": "select",
          "required": true,
          "apiEndpoint": "ESPECIES"
        },
        {
          "label": "Producto",
          "header": "Producto",
          "name": "producto",
          "type": "select",
          "required": true,
          "apiEndpoint": "PRODUCTOS"
        },
        {
          "label": "Lote",
          "header": "Lote",
          "name": "lote",
          "type": "text",
          "required": true
        },
        {
          "label": "Temperatura (°C)",
          "header": "Temp. (°C)",
          "name": "temperatura",
          "type": "temperature",
          "required": true
        },
        {
          "label": "Apariencia",
          "header": "Apariencia",
          "name": "apariencia",
          "type": "select",
          "options": ["Excelente", "Buena", "Regular", "Mala"],
          "required": true
        },
        {
          "label": "Olor",
          "header": "Olor",
          "name": "olor",
          "type": "select",
          "options": ["Normal", "Leve Alteración", "Rechazado"],
          "required": true
        },
        {
          "label": "Textura",
          "header": "Textura",
          "name": "textura",
          "type": "select",
          "options": ["Firme", "Suave", "Blanda"],
          "required": true
        },
        {
          "label": "Resultado",
          "header": "Resultado",
          "name": "resultado",
          "type": "select",
          "options": ["APROBADO", "APROBADO CON OBSERVACIONES", "RECHAZADO"],
          "required": true
        }
      ],
      "defaultRows": 8
    }
  ],
  "firmas": [
    {
      "puesto": "Inspector de Calidad"
    },
    {
      "puesto": "Jefe de Aseguramiento de Calidad"
    }
  ]
}
```

**Campos con API:**
- ✅ Proveedor → Carga desde `/Proveedores`
- ✅ Especie (tabla) → Carga desde `/Especies`
- ✅ Producto (tabla) → Carga desde `/Productos`

---

## 🎯 Resumen de Campos Dinámicos

| Campo | Endpoint | Muestra |
|-------|----------|---------|
| Proveedor/Cliente | `PROVEEDORES` | Razón Social |
| Chofer | `CHOFERES` | Nombre Completo |
| Embarcación/Pesquero | `PESQUEROS` | Nombre |
| Especie | `ESPECIES` | Nombre |
| Producto | `PRODUCTOS` | Descripción |
| Balanza | `BALANZAS` | Nombre |
| Frigorífico | `CONFIGURACIONES_FRIGO` | Descripción |

---

## 🔧 Cómo Crear tus Propios Templates

1. **Abre CreateTemplate.jsx**
2. **Copia uno de los ejemplos anteriores**
3. **Modifica según tus necesidades**
4. **Para campos que quieres que sean dinámicos:**
   - Tipo: `select`
   - Agrega: `"apiEndpoint": "NOMBRE_ENDPOINT"`
5. **Guarda el template**
6. **Prueba llenando un formulario**

---

## ✅ ¡Listo!

Ahora tienes ejemplos completos de templates que usan las APIs implementadas. Solo necesitas copiar, modificar y guardar. 🎉
