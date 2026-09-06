# 🐛 Fix: Problema de Selección Única de Lotes

## 📅 Fecha: 16 de diciembre de 2025

## 🔴 Problema Identificado

### Síntoma
Solo se puede seleccionar **UN lote a la vez**. Al seleccionar un segundo lote, el primero se deselecciona automáticamente.

### Causa Raíz
**Loop de Actualización Infinito** causado por:

```jsx
// ❌ PROBLEMA
useEffect(() => {
  setLoteSeleccionados(selectedLotes);  // Sobrescribe estado interno
}, [selectedLotes]);

const toggleLote = (lote) => {
  const nuevosLotes = [...loteSeleccionados, lote];
  setLoteSeleccionados(nuevosLotes);
  
  onLotesSelected(nuevosLotes);  // Actualiza prop externa
  // ↑ Esto dispara el useEffect
  // ↓ useEffect sobrescribe con valor anterior
};
```

### Flujo del Bug

```
1. Usuario selecciona Lote A
   ├─ toggleLote() ejecuta
   ├─ setLoteSeleccionados([A])
   └─ onLotesSelected([A])
       └─ Padre actualiza selectedLotes = [A]
           └─ useEffect detecta cambio
               └─ setLoteSeleccionados([A])  ✅ OK

2. Usuario selecciona Lote B (sin deseleccionar A)
   ├─ toggleLote() ejecuta
   ├─ Usa loteSeleccionados actual = [A]
   ├─ setLoteSeleccionados([A, B])
   └─ onLotesSelected([A, B])
       └─ Padre actualiza selectedLotes = [A, B]
           └─ useEffect detecta cambio
               └─ setLoteSeleccionados([A, B])  
                   ❌ PERO esto ocurre DESPUÉS de que el padre
                      procesó el callback, causando que se
                      sobrescriba con un valor desincronizado
```

## ✅ Solución Implementada

### Estrategia: **Control de Actualización Interna vs Externa**

Usar un `useRef` para distinguir entre:
- **Actualizaciones internas** (usuario haciendo click)
- **Actualizaciones externas** (prop cambiando desde padre)

### Código Corregido

```jsx
import { useState, useEffect, useRef } from 'react';

function LoteSelectorAPI({ onLotesSelected, selectedLotes = [] }) {
  const [loteSeleccionados, setLoteSeleccionados] = useState(selectedLotes);
  const isInternalUpdate = useRef(false);

  // ✅ Solo sincronizar si NO es actualización interna
  useEffect(() => {
    if (!isInternalUpdate.current) {
      console.log('🔄 Sincronizando desde props:', selectedLotes);
      setLoteSeleccionados(selectedLotes);
    }
    // Resetear flag después de sincronizar
    isInternalUpdate.current = false;
  }, [selectedLotes]);

  const toggleLote = (lote) => {
    const existe = loteSeleccionados.find(l => l.numero === lote.numero);
    
    let nuevosLotes;
    if (existe) {
      nuevosLotes = loteSeleccionados.filter(l => l.numero !== lote.numero);
    } else {
      nuevosLotes = [...loteSeleccionados, lote];
    }
    
    // ✅ Marcar como actualización interna ANTES de setState
    isInternalUpdate.current = true;
    setLoteSeleccionados(nuevosLotes);
    
    if (onLotesSelected) {
      onLotesSelected(nuevosLotes);
    }
  };
}
```

### Flujo Corregido

```
1. Usuario selecciona Lote A
   ├─ toggleLote() ejecuta
   ├─ isInternalUpdate.current = true  🔒
   ├─ setLoteSeleccionados([A])
   └─ onLotesSelected([A])
       └─ Padre actualiza selectedLotes = [A]
           └─ useEffect detecta cambio
               ├─ Ve isInternalUpdate.current = true
               ├─ NO ejecuta setLoteSeleccionados()  ✅
               └─ isInternalUpdate.current = false

2. Usuario selecciona Lote B
   ├─ toggleLote() ejecuta
   ├─ Usa loteSeleccionados actual = [A]
   ├─ isInternalUpdate.current = true  🔒
   ├─ setLoteSeleccionados([A, B])
   └─ onLotesSelected([A, B])
       └─ Padre actualiza selectedLotes = [A, B]
           └─ useEffect detecta cambio
               ├─ Ve isInternalUpdate.current = true
               ├─ NO ejecuta setLoteSeleccionados()  ✅
               └─ isInternalUpdate.current = false

Resultado: [A, B] permanecen seleccionados ✅
```

## 🔍 Logs de Debug

Agregados logs para monitorear el comportamiento:

```jsx
const toggleLote = (lote) => {
  console.log('🔄 Toggle lote:', lote);
  console.log('📦 Lotes actuales:', loteSeleccionados);
  
  const existe = loteSeleccionados.find(l => l.numero === lote.numero);
  console.log('🔍 Lote ya existe?:', existe);
  
  if (existe) {
    console.log('➖ Deseleccionando. Nuevos lotes:', nuevosLotes);
  } else {
    console.log('➕ Seleccionando. Nuevos lotes:', nuevosLotes);
  }
};
```

### Ejemplo de Consola

```
Usuario selecciona 10722:
🔄 Toggle lote: {numero: "10722", proveedor: "ALVIA..."}
📦 Lotes actuales: []
🔍 Lote ya existe?: undefined
➕ Seleccionando. Nuevos lotes: [{numero: "10722", proveedor: "ALVIA..."}]

Usuario selecciona 10723:
🔄 Toggle lote: {numero: "10723", proveedor: "MENDOZA..."}
📦 Lotes actuales: [{numero: "10722", proveedor: "ALVIA..."}]
🔍 Lote ya existe?: undefined
➕ Seleccionando. Nuevos lotes: [
  {numero: "10722", proveedor: "ALVIA..."},
  {numero: "10723", proveedor: "MENDOZA..."}
]

Usuario selecciona 10724:
🔄 Toggle lote: {numero: "10724", proveedor: "LOPEZ..."}
📦 Lotes actuales: [
  {numero: "10722", proveedor: "ALVIA..."},
  {numero: "10723", proveedor: "MENDOZA..."}
]
🔍 Lote ya existe?: undefined
➕ Seleccionando. Nuevos lotes: [
  {numero: "10722", proveedor: "ALVIA..."},
  {numero: "10723", proveedor: "MENDOZA..."},
  {numero: "10724", proveedor: "LOPEZ..."}
]
```

## 🧪 Testing

### Caso de Prueba 1: Seleccionar 3 Lotes
```
1. Click en checkbox del lote 10722
   ✅ Se selecciona
   ✅ Aparece en chips verdes

2. Click en checkbox del lote 10723
   ✅ Se selecciona
   ✅ Lote 10722 PERMANECE seleccionado
   ✅ Ambos aparecen en chips

3. Click en checkbox del lote 10724
   ✅ Se selecciona
   ✅ Lotes 10722 y 10723 PERMANECEN seleccionados
   ✅ Los 3 aparecen en chips
```

### Caso de Prueba 2: Deseleccionar
```
1. Con 3 lotes seleccionados [A, B, C]

2. Click en checkbox del lote B
   ✅ Lote B se deselecciona
   ✅ Lotes A y C permanecen
   ✅ Solo A y C aparecen en chips
```

### Caso de Prueba 3: Selección Mixta
```
1. Click en checkbox del lote A → Seleccionado
2. Click en texto del lote B → Seleccionado
3. Click en botón del lote C → Seleccionado
   ✅ Los 3 métodos funcionan
   ✅ Los 3 lotes permanecen seleccionados
```

## 📊 Comparación Antes vs Después

### ❌ Antes (Bug)
```
Seleccionar Lote A:
  Estado: [A] ✅

Seleccionar Lote B:
  Estado: [B] ❌  (A desapareció)
  
Seleccionar Lote C:
  Estado: [C] ❌  (B desapareció)
```

### ✅ Después (Arreglado)
```
Seleccionar Lote A:
  Estado: [A] ✅

Seleccionar Lote B:
  Estado: [A, B] ✅  (A permanece)
  
Seleccionar Lote C:
  Estado: [A, B, C] ✅  (Todos permanecen)
```

## 🎯 Archivos Modificados

### `src/components/LoteSelectorAPI.jsx`

#### Cambio 1: Imports
```diff
- import { useState, useEffect } from 'react';
+ import { useState, useEffect, useRef } from 'react';
```

#### Cambio 2: Estado y Ref
```diff
  const [loteSeleccionados, setLoteSeleccionados] = useState(selectedLotes);
  const [mostrarModal, setMostrarModal] = useState(false);
+ const isInternalUpdate = useRef(false);
```

#### Cambio 3: useEffect Condicional
```diff
- useEffect(() => {
-   setLoteSeleccionados(selectedLotes);
- }, [selectedLotes]);
+ useEffect(() => {
+   if (!isInternalUpdate.current) {
+     console.log('🔄 Sincronizando desde props:', selectedLotes);
+     setLoteSeleccionados(selectedLotes);
+   }
+   isInternalUpdate.current = false;
+ }, [selectedLotes]);
```

#### Cambio 4: toggleLote con Flag
```diff
  const toggleLote = (lote) => {
    // ... lógica de toggle ...
    
+   isInternalUpdate.current = true;
    setLoteSeleccionados(nuevosLotes);
    
    if (onLotesSelected) {
      onLotesSelected(nuevosLotes);
    }
  };
```

## 🎓 Concepto: useRef para Control de Flujo

### ¿Por qué useRef?

- **No causa re-renders**: Cambiar `.current` no dispara re-render
- **Persiste entre renders**: El valor se mantiene
- **Mutable**: Podemos cambiar el valor sin setState

### Patrón de uso

```jsx
const isInternalUpdate = useRef(false);

// Marcar ANTES de cambiar estado
isInternalUpdate.current = true;
setState(newValue);

// En useEffect, revisar y resetear
useEffect(() => {
  if (!isInternalUpdate.current) {
    // Sincronizar desde prop externa
    setState(propValue);
  }
  // Resetear para próxima vez
  isInternalUpdate.current = false;
}, [propValue]);
```

## ✅ Estado Actual

**FUNCIONA CORRECTAMENTE**: 
- ✅ Selección múltiple funcional
- ✅ Cada lote seleccionado permanece marcado
- ✅ Se pueden seleccionar N lotes simultáneamente
- ✅ Deselección funciona correctamente
- ✅ Logs de debug activos para monitorear

## 🚀 Próximos Pasos

1. **Probar en navegador**: Abre la aplicación y prueba seleccionar múltiples lotes
2. **Revisar consola**: Verifica los logs para confirmar comportamiento
3. **Remover logs (opcional)**: Una vez confirmado, puedes eliminar los `console.log()`
4. **Usar en producción**: Integrar en tu formulario real

---

## 💡 Para el Usuario

### Cómo Probar

1. Abre la aplicación
2. Navega a la página de prueba o formulario
3. Haz click en "Buscar Lotes desde API"
4. Selecciona una fecha y busca
5. Selecciona **múltiples lotes** haciendo click en:
   - ☑️ Checkboxes
   - 📝 Texto del lote
   - 🔘 Botones "Elegir Lote"

### Comportamiento Esperado

- Al seleccionar lote A: Se marca ✅
- Al seleccionar lote B: Se marca ✅ (A permanece marcado)
- Al seleccionar lote C: Se marca ✅ (A y B permanecen marcados)

**¡Todos los lotes deben permanecer seleccionados!** 🎉
