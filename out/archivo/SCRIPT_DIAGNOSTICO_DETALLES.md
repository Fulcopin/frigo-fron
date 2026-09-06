# 🔍 Script de Diagnóstico: Verificar Datos de Detalles

## Copiar y Pegar en la Consola del Navegador

Después de seleccionar un lote, copia y pega este código en la consola (F12 → Console):

```javascript
// 🔍 DIAGNÓSTICO COMPLETO DE DATOS
console.log('═══════════════════════════════════════');
console.log('🔍 DIAGNÓSTICO DE DATOS DE DETALLES');
console.log('═══════════════════════════════════════');

// Verificar apiDetailsData
if (window.apiDetailsDataGlobal) {
  console.log('✅ apiDetailsData existe');
  console.log('📊 Total de items:', window.apiDetailsDataGlobal.length);
  
  if (window.apiDetailsDataGlobal.length > 0) {
    console.log('📋 Primer item:', window.apiDetailsDataGlobal[0]);
    console.log('🔑 Campos disponibles:', Object.keys(window.apiDetailsDataGlobal[0]));
    
    // Filtrar solo campos que empiecen con "det"
    const detFields = Object.keys(window.apiDetailsDataGlobal[0]).filter(k => k.startsWith('det'));
    console.log('🎯 Campos de DETALLES (det*):', detFields);
    
    // Mostrar valores únicos de cada campo
    detFields.forEach(field => {
      const uniqueValues = [...new Set(window.apiDetailsDataGlobal.map(item => item[field]))].filter(Boolean);
      console.log(`   📦 ${field}: ${uniqueValues.length} valores únicos`, uniqueValues.slice(0, 5));
    });
  } else {
    console.warn('⚠️ apiDetailsData está vacío');
  }
} else {
  console.error('❌ apiDetailsData NO existe');
  console.log('💡 Esto significa que no se han cargado detalles de ningún lote');
}

console.log('═══════════════════════════════════════');
```

## Qué Deberías Ver:

### ✅ Si Todo Está Bien:
```
═══════════════════════════════════════
🔍 DIAGNÓSTICO DE DATOS DE DETALLES
═══════════════════════════════════════
✅ apiDetailsData existe
📊 Total de items: 39
📋 Primer item: {detId: 1, detEspecie: "ATÚN", detProducto: "PESCA", ...}
🔑 Campos disponibles: ["detId", "detCabId", "detEspecie", "detProducto", ...]
🎯 Campos de DETALLES (det*): ["detId", "detEspecie", "detProducto", "detTipoControl", ...]
   📦 detEspecie: 3 valores únicos ["ATÚN", "DORADO", "PERICO"]
   📦 detProducto: 2 valores únicos ["PESCA FRESCA", "CONGELADO"]
   📦 detTipoControl: 1 valores únicos ["CALIDAD A"]
═══════════════════════════════════════
```

### ❌ Si Hay Problema:
```
❌ apiDetailsData NO existe
💡 Esto significa que no se han cargado detalles de ningún lote
```

## Instrucciones:

1. **Abre el formulario**
2. **Selecciona un lote**
3. **Espera a que cargue**
4. **Abre la consola** (F12)
5. **Pega este script**
6. **Copia el resultado** y envíamelo

---

## Alternativa: Desde React DevTools

Si tienes React DevTools instalado:

1. Abre React DevTools (F12 → React)
2. Busca el componente `FillForm`
3. Ve a "Props" o "Hooks"
4. Busca `apiDetailsData`
5. Expande el array y verifica si tiene datos

---

**Nota**: Este script necesita que primero se expongan los datos globalmente. Si no funciona, te daré otra forma de verificar.
