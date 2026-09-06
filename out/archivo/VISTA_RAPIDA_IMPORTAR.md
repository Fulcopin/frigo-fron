# 🎯 VISTA RÁPIDA: Importar Columnas

## 1️⃣ BUSCA EL BOTÓN 📥

```
┌─────────────────────────────────────────────────────────────┐
│  Tabla de Control de Fileteo                                │
├────┬──────────┬────────────────────┬─────────────┬─────────┤
│ #  │ FECHA 📥 │ PESO NETO LBS 📥  │ OBSERV. 📥 │ Acciones│
├────┼──────────┼────────────────────┼─────────────┼─────────┤
│ 1  │          │                    │             │   ❌    │
│ 2  │          │                    │             │   ❌    │
│ 3  │          │                    │             │   ❌    │
└────┴──────────┴────────────────────┴─────────────┴─────────┘
          ↑              ↑                 ↑
    HAZ CLIC AQUÍ  O AQUÍ           O AQUÍ
```

## 2️⃣ SE ABRE EL MODAL

```
╔═══════════════════════════════════════════════════════════╗
║  📥 Importar Columna Automáticamente                  ✕   ║
║  Copiar toda la columna desde otro formulario →           ║
║  "PESO NETO LBS"                                          ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  1️⃣ Selecciona un formulario guardado:                   ║
║                                                           ║
║  ┌─────────────────────┐  ┌─────────────────────┐       ║
║  │ 📄 Registro 15 Tinas│  │ 📄 Control de       │       ║
║  │ 🔢 ID: 17           │  │    Producción       │       ║
║  │ 📅 2025-12-22       │  │ 🔢 ID: 16           │       ║
║  │ 📊 15 filas         │  │ 📅 2025-12-21       │       ║
║  │ [HAZ CLIC AQUÍ] ←──│  │ 📊 20 filas         │       ║
║  └─────────────────────┘  └─────────────────────┘       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

## 3️⃣ DESPUÉS DE HACER CLIC EN UN FORMULARIO

```
╔═══════════════════════════════════════════════════════════╗
║  📥 Importar Columna Automáticamente              [← Volver]║
╠═══════════════════════════════════════════════════════════╣
║  📄 Formulario origen: Registro 15 Tinas (ID: 17)         ║
║  🎯 Columna destino: PESO NETO LBS                        ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  2️⃣ Selecciona la columna a importar:                    ║
║                                                           ║
║  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   ║
║  │  HORA    │ │  TINA    │ │  PESO1   │ │  TOTAL   │   ║
║  │ 0 valores│ │15 valores│ │10 valores│ │15 valores│   ║
║  │ Ej: -    │ │ Ej: T1   │ │ Ej: 44   │ │Ej:16086.9│   ║
║  └──────────┘ └──────────┘ └──────────┘ └──────────┘   ║
║       ↑             ↑            ↑     HAZ CLIC ↑       ║
║    Columna       Columna      Columna    AQUÍ           ║
║    vacía       con datos    con datos  PARA COPIAR     ║
║                                                           ║
║  📊 Vista previa de datos:                               ║
║  ┌────┬──────┬──────┬───────┬────────┬─────────┐       ║
║  │ #  │ HORA │ TINA │ PESO1 │ PESO2  │  TOTAL  │       ║
║  ├────┼──────┼──────┼───────┼────────┼─────────┤       ║
║  │ 1  │      │ T1   │ 44    │ 444    │ 16086.99│       ║
║  │ 2  │      │ T2   │       │        │         │       ║
║  │ 3  │      │ T3   │       │        │         │       ║
║  └────┴──────┴──────┴───────┴────────┴─────────┘       ║
╚═══════════════════════════════════════════════════════════╝
```

## 4️⃣ RESULTADO DESPUÉS DE IMPORTAR

```
┌─────────────────────────────────────────────────────────────┐
│  Tabla de Control de Fileteo                                │
├────┬──────────┬────────────────────┬─────────────┬─────────┤
│ #  │ FECHA    │ PESO NETO LBS 📥  │ OBSERV.     │ Acciones│
├────┼──────────┼────────────────────┼─────────────┼─────────┤
│ 1  │          │  16086.99 ✅       │             │   ❌    │
│ 2  │          │  8500.50 ✅        │             │   ❌    │
│ 3  │          │  7200.00 ✅        │             │   ❌    │
│ 4  │          │  9800.00 ✅        │             │   ❌    │
└────┴──────────┴────────────────────┴─────────────┴─────────┘
                      ↑ ↑ ↑ ↑
              VALORES COPIADOS AUTOMÁTICAMENTE
             DESDE LA COLUMNA TOTAL DE "15 TINAS"
```

## 🎉 MENSAJE DE CONFIRMACIÓN

```
╔════════════════════════════════════╗
║  ✅ ¡Columna importada!            ║
║                                    ║
║  📤 Origen: TOTAL                  ║
║  📥 Destino: PESO NETO LBS         ║
║  📊 15 valores copiados            ║
║                                    ║
║         [ OK ]                     ║
╚════════════════════════════════════╝
```

---

## 🚀 INICIO RÁPIDO EN 4 PASOS

1. **Abre** el formulario donde quieres PEGAR datos
2. **Haz clic** en el botón 📥 de la columna destino
3. **Selecciona** el formulario origen de la lista
4. **Haz clic** en el botón de la columna origen (ej: TOTAL)

**¡LISTO!** Los datos se copian automáticamente.
