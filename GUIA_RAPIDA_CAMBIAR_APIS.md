# 🚀 GUÍA RÁPIDA - Cambiar URLs de APIs

## ⚡ CAMBIO RÁPIDO

### **Solo necesitas editar 1 archivo: `.env`**

```env
# Cambiar estas dos líneas:
VITE_API_BASE_URL=http://tu-nuevo-servidor/api
VITE_API_EXTERNAL_URL=http://tu-api-externa/api
```

### **Luego reiniciar:**

```bash
# Detener: Ctrl+C
npm run dev
```

---

## 📍 UBICACIÓN DEL ARCHIVO

```
frigo-fron/
└── .env  ← AQUÍ
```

---

## 🎯 VALORES ACTUALES

```env
# API Principal (Templates, Formularios)
VITE_API_BASE_URL=http://localhost:5074/api

# API Externa (Auth, Lotes, Usuarios)
VITE_API_EXTERNAL_URL=http://188.40.197.172:8094/api
```

---

## 🔄 EJEMPLOS COMUNES

### **Cambiar a servidor de pruebas:**
```env
VITE_API_BASE_URL=http://192.168.1.100:5074/api
```

### **Cambiar a producción:**
```env
VITE_API_BASE_URL=http://produccion.miempresa.com/api
VITE_API_EXTERNAL_URL=http://api.miempresa.com/api
```

### **Cambiar puerto local:**
```env
VITE_API_BASE_URL=http://localhost:8080/api
```

---

## ✅ VERIFICAR QUE FUNCIONÓ

Abre la consola del navegador (F12) y busca:

```
✅ APIs configuradas: { base: "...", external: "..." }
```

---

## ⚠️ IMPORTANTE

1. **Siempre reiniciar después de cambiar**
2. **Las variables deben empezar con `VITE_`**
3. **No subir `.env` a Git** (debe estar en `.gitignore`)

---

## 🆘 SI NO FUNCIONA

1. Verifica que el archivo se llama `.env` (sin extensión adicional)
2. Verifica que está en la raíz del proyecto
3. Reinicia el servidor completamente
4. Limpia cache: `npm run dev -- --force`

---

## 📚 MÁS INFO

Ver: `CENTRALIZACION_APIS_ENV.md`
