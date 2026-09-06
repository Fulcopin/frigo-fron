# 🔐 CÓMO FUNCIONA EL NUEVO SISTEMA DE FIRMAS

## 🎯 REGLA PRINCIPAL

**"Solo puedes firmar TUS propios documentos, no los de otros"**

---

## 👥 ROLES

### 1️⃣ ADMINISTRADOR/SUPERVISOR
- Va a `/catalogo-firmas`
- Registra quiénes están autorizados para firmar
- Ejemplo: Agrega a "Juan Martin" como "Jefe de Calidad"

### 2️⃣ USUARIO NORMAL (Juan Martin)
- Hace login con su cuenta
- Va a llenar un formulario
- **SOLO PUEDE FIRMAR DONDE SU PUESTO COINCIDE**

---

## 📝 EJEMPLO PRÁCTICO

### FORMULARIO: Control de Temperatura

**Firmas requeridas:**
1. Jefe Aseguramiento de Calidad
2. Supervisora de Producción  
3. Liquidadora de Producción

---

### JUAN MARTIN hace login (Jefe Aseguramiento de Calidad)

#### ✅ Firma 1: "Jefe Aseguramiento de Calidad"
```
┌─────────────────────────────────────┐
│ Jefe Aseguramiento de Calidad       │
├─────────────────────────────────────┤
│ Nombre: [Juan Martin]      ← SOLO ÉL│
│ Fecha:  [18/02/2026]                │
│ Firma:  [Subir imagen]              │
└─────────────────────────────────────┘
```
✅ **Puede firmar**: Es SU puesto  
🎯 **Opciones**: Solo ve su nombre

---

#### ❌ Firma 2: "Supervisora de Producción"
```
┌─────────────────────────────────────┐
│ Supervisora de Producción           │
├─────────────────────────────────────┤
│ Nombre: [María López]      ← DEL CATÁLOGO│
│ Fecha:  [         ]                 │
│ Firma:  [         ]                 │
└─────────────────────────────────────┘
```
❌ **NO puede firmar**: No es su puesto  
📋 **Opciones**: Ve a María López (del catálogo)  
⏳ **Debe**: Esperar a que María firme

---

#### ❌ Firma 3: "Liquidadora de Producción"
```
┌─────────────────────────────────────┐
│ Liquidadora de Producción           │
├─────────────────────────────────────┤
│ Nombre: [Ana Gómez]        ← DEL CATÁLOGO│
│ Fecha:  [         ]                 │
│ Firma:  [         ]                 │
└─────────────────────────────────────┘
```
❌ **NO puede firmar**: No es su puesto  
📋 **Opciones**: Ve a Ana Gómez (del catálogo)  
⏳ **Debe**: Esperar a que Ana firme

---

## 🔄 FLUJO COMPLETO

```
┌──────────────────────────────┐
│ 1. ADMIN agrega usuarios     │
│    en /catalogo-firmas       │
│                              │
│    - Juan Martin (Jefe Cal.) │
│    - María López (Superv.)   │
│    - Ana Gómez (Liquidadora) │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ 2. JUAN login y abre form.   │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ 3. Para "Jefe Cal.":         │
│    ✅ Firma como Juan Martin │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ 4. Para "Supervisora":       │
│    ❌ Ve a María (no firma)  │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ 5. MARÍA login más tarde     │
│    ✅ Firma como Supervisora │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ 6. ANA login más tarde       │
│    ✅ Firma como Liquidadora │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ ✅ FORMULARIO COMPLETO       │
│    con 3 firmas válidas      │
└──────────────────────────────┘
```

---

## ❓ PREGUNTAS FRECUENTES

### ¿Por qué no veo mi nombre en una firma?
**R:** Porque ese puesto no es el tuyo. Debes firmar solo donde tu puesto coincide.

### ¿Puedo firmar por mi compañero que no vino hoy?
**R:** ❌ NO. Cada persona firma solo SU puesto. No hay suplantación.

### ¿Qué pasa si no hay nadie en el catálogo para una firma?
**R:** El Admin debe ir a `/catalogo-firmas` y agregar a la persona autorizada.

### ¿Puedo ver quién está autorizado para firmar?
**R:** Sí, aparecen en el selector (del catálogo), pero solo pueden firmar ellos mismos cuando hagan login.

---

## 🎯 VENTAJAS DEL SISTEMA

| Ventaja | Descripción |
|---------|-------------|
| ✅ **Sin fraude** | Nadie puede firmar por otros |
| ✅ **Trazabilidad** | Cada firma está vinculada al login real |
| ✅ **Control** | Admin decide quiénes están autorizados |
| ✅ **Transparencia** | Los usuarios ven quién debe firmar |

---

## 🚨 IMPORTANTE

### ✅ LO QUE SÍ PUEDES HACER:
- Firmar en TU puesto
- Ver quién más debe firmar
- Subir TU firma digital

### ❌ LO QUE NO PUEDES HACER:
- Firmar por otros
- Cambiar de puesto
- Saltarte firmas requeridas

---

## 📞 AYUDA

**Si no puedes firmar:**
1. Verifica que estés en la sección de TU puesto
2. Verifica que estés logueado con tu usuario correcto
3. Si ves a otra persona en el selector, es porque ESA persona debe firmar

**Si falta alguien en el catálogo:**
1. Contacta al Admin/Supervisor
2. Pídele que agregue a la persona en `/catalogo-firmas`
3. Recarga el formulario

---

**Sistema implementado**: 18 de febrero de 2026  
**Estado**: ✅ Activo y funcionando
