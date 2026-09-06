# 🚀 GUÍA RÁPIDA: Agregar Opciones Sí/No a un Campo Select

## ⚡ Pasos Rápidos (30 segundos)

### 1️⃣ Selecciona Tipo "Lista Desplegable (Select)"
Cuando crees un campo, elige **"Lista Desplegable (Select)"** en el dropdown de tipo.

### 2️⃣ Escribe las Opciones
Aparecerá un nuevo campo:
```
📝 Opciones Personalizadas (separadas por coma)
[                                            ]
```

### 3️⃣ Escribe: `Sí, No`
O cualquier otra combinación:
```
Sí, No
```
```
Aprobado, Rechazado
```
```
Completo, Incompleto
```

### 4️⃣ ¡Listo!
Al guardar la plantilla y llenar el formulario, verás un select con esas opciones.

---

## 📍 ¿Dónde Funciona?

✅ **Campos del Header** (parte superior del formulario)  
✅ **Campos de Secciones** (dentro de secciones personalizadas)  
✅ **Columnas de Tablas** (en las tablas dinámicas)

---

## 💡 Ejemplos Rápidos

### Ejemplo 1: Campo Sí/No
```
Etiqueta: "¿Aprobado?"
Tipo: Lista Desplegable (Select)
Opciones: Sí, No
```

### Ejemplo 2: Estado de Calidad
```
Etiqueta: "Estado"
Tipo: Lista Desplegable (Select)
Opciones: Aprobado, Rechazado, En Revisión
```

### Ejemplo 3: Asistencia
```
Etiqueta: "Asistencia"
Tipo: Lista Desplegable (Select)
Opciones: Presente, Ausente, Tardanza
```

---

## ⚠️ Importante

- **Separa con comas:** `Opción 1, Opción 2, Opción 3`
- **No uses APIs si pones opciones manuales:** Solo usa uno u otro
- **Los espacios se eliminan automáticamente:** `Sí, No` = `Sí,No`

---

## 🎯 Caso de Uso Más Común

```
Campo: "¿Cumple?"
Opciones: Sí, No
```

¡Eso es todo! 🎉

---

**Versión:** 1.0.0  
**Fecha:** 30 de enero de 2026
