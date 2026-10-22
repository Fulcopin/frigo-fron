# Notas estáticas en versiones anteriores (FOR-CC-07)

## El problema

En la versión **5** de `FOR-CC-07` se agregaron 6 bloques de solo texto (notas
estáticas): las *Referencias* y las 5 *Declaraciones* (alérgenos, Clostridium,
almacenamiento, cocción y SYSCO).

Los registros viejos no las muestran porque:

| Dónde se guarda | Qué pasa |
|---|---|
| `FilledForms.TemplateSnapshot` | Cada registro guardó una copia congelada del formulario **sin** las notas (v4 tenía 4 elementos). |
| `TemplateVersions.BodyElements` | La versión histórica 4 tiene su propia estructura, también sin las 5 declaraciones. |

Por eso había que imprimir la hoja aparte y adjuntarla.

## La solución

Dos endpoints de mantenimiento que **copian las notas de la versión actual hacia
atrás**. Nunca borran ni modifican datos capturados: solo agregan texto.

```
GET  /api/Mantenimiento/notas-faltantes?codigo=FOR-CC-07        (solo lee)
POST /api/Mantenimiento/copiar-notas-versiones?codigo=FOR-CC-07 (aplica)
```

Es **idempotente**: si se corre dos veces, la segunda no cambia nada.

## Despliegue

1. Copiar `FormBuilder.API.dll` y `FormBuilder.API.pdb` de
   `actualizacion-backend.zip` a `C:\inetpub\wwwroot\DeployFormularios`
   (**no** reemplazar `appsettings.json`).
2. Reciclar el App Pool en IIS.

Este paquete incluye también el arreglo de imágenes
(`/api/Images/proxy`, precarga y diagnóstico).

### Automático (recomendado)

En el servidor, con PowerShell **como Administrador**:

1. Descomprimir `actualizacion-backend.zip` en una carpeta.
2. Copiar `APLICAR-NOTAS-CC07.ps1` en esa misma carpeta.
3. Ejecutar:

```powershell
powershell -ExecutionPolicy Bypass -File .\APLICAR-NOTAS-CC07.ps1
```

El script respalda el DLL actual, copia los archivos, recicla el App Pool,
muestra qué falta, pide confirmación (`SI`) y verifica al final.

Para mirar sin cambiar nada:

```powershell
powershell -ExecutionPolicy Bypass -File .\APLICAR-NOTAS-CC07.ps1 -SoloVerificar
```

### Manual

## Verificar antes de aplicar (solo lectura)

Abrir en el navegador:

```
http://192.168.0.88:8096/api/Mantenimiento/notas-faltantes?codigo=FOR-CC-07
```

Debe responder algo así:

```json
{
  "codigo": "FOR-CC-07",
  "templateId": 57,
  "versionActual": "5",
  "notas": [ 6 notas: NOTA + 5 DECLARACIONES ],
  "versiones": [
    { "version": "5", "esActual": true,  "elementos": 11, "notasFaltantes": 0 },
    { "version": "4", "esActual": false, "elementos": 5,  "notasFaltantes": 5 }
  ],
  "registros": { "total": 136, "sinNotas": 46, "porVersion": { "4": 46 } },
  "mensaje": "Vista previa: NO se cambió nada..."
}
```

Interpretación:

- `notasFaltantes` = cuántas notas le faltan a esa versión.
- `registros.sinNotas` = formularios que hoy no muestran las notas.

Si los números no coinciden con lo anterior, **no aplicar** y avisar.

## Aplicar

Opción A — desde el navegador con la consola (F12) en la pantalla del sistema:

```js
await fetch('http://192.168.0.88:8096/api/Mantenimiento/copiar-notas-versiones?codigo=FOR-CC-07', { method: 'POST' })
  .then(r => r.json())
```

Opción B — PowerShell en el servidor:

```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:8096/api/Mantenimiento/copiar-notas-versiones?codigo=FOR-CC-07"
```

Respuesta esperada:

```json
{
  "success": true,
  "notasDisponibles": 6,
  "versionesCambiadas": 1,
  "notasEnVersiones": 5,
  "registrosCambiados": 46,
  "notasEnRegistros": 276,
  "porVersion": { "4": 46 }
}
```

## Verificar después

1. Volver a abrir `notas-faltantes`: debe dar `notasFaltantes: 0` en todas las
   versiones y `sinNotas: 0` en registros.
2. Abrir un registro viejo (por ejemplo el formulario **1023**, del 29/06/2026),
   imprimirlo o exportarlo a PDF: deben salir las *Referencias* y las 5
   *Declaraciones*.
3. Comparar versiones 4 y 5: los bloques de notas ya aparecen en ambas.

## Si algo sale mal

Las notas solo se **agregan**; no se borra nada. Para volver atrás alcanza con
quitar del JSON esos bloques (ids `1792187017951`, `1792187018438`,
`1792187019487`, `1792187020005`, `1792187020453` y `1783527388595`), o restaurar
el respaldo de `Templates`, `TemplateVersions` y `FilledForms` tomado antes de
aplicar.

## Cuándo volver a correrlo

Cada vez que se agreguen notas nuevas a la plantilla, ejecutar de nuevo el
`POST`: copia solo las que falten.
