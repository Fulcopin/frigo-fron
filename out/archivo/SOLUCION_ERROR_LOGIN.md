# 🔐 Solución: Error 400 en Login

## ❌ Error Reportado

```
POST http://localhost:4000/api/auth/login 400 (Bad Request)
```

**Archivo:** `auth-context.tsx:183`  
**Proyecto:** distributivofinal (diferente al actual)

---

## 🔍 Diagnóstico

Un **error 400** significa que el servidor rechazó la petición por:

1. **Datos faltantes o incorrectos** en el body
2. **Formato JSON inválido**
3. **Validación fallida** en el backend
4. **Headers incorrectos**

---

## ✅ Soluciones Comunes

### Solución 1: Verificar Body de la Petición

**Revisar en `auth-context.tsx` línea 183:**

```typescript
// ❌ INCORRECTO
const response = await fetch('http://localhost:4000/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({
    username: username,  // ¿Debería ser "email"?
    password: password
  })
});

// ✅ CORRECTO
const response = await fetch('http://localhost:4000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',  // ← IMPORTANTE
  },
  body: JSON.stringify({
    email: email,        // ← Verifica el campo correcto
    password: password
  })
});
```

### Solución 2: Agregar Headers

```typescript
const response = await fetch('http://localhost:4000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  body: JSON.stringify({
    email: email,
    password: password
  })
});
```

### Solución 3: Verificar Backend

**Revisar qué espera el endpoint:**

```typescript
// En tu backend (Node.js/Express ejemplo)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  // Verificar que existan
  if (!email || !password) {
    return res.status(400).json({ 
      error: 'Email y password son requeridos' 
    });
  }
  
  // ... resto del código
});
```

### Solución 4: Log del Error Completo

```typescript
try {
  const response = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('❌ Error del servidor:', errorData);
    throw new Error(errorData.message || 'Login falló');
  }

  const data = await response.json();
  return data;
  
} catch (error) {
  console.error('❌ Error en login:', error);
  throw error;
}
```

---

## 🔧 Checklist de Depuración

### 1. Verificar el Body
```typescript
const loginData = { email, password };
console.log('📤 Enviando:', loginData);

const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(loginData)
});
```

### 2. Verificar la Respuesta
```typescript
console.log('📥 Status:', response.status);
const data = await response.json();
console.log('📥 Respuesta:', data);
```

### 3. Verificar el Backend
```bash
# En tu backend, agregar logs
console.log('📥 Body recibido:', req.body);
console.log('📧 Email:', req.body.email);
console.log('🔒 Password:', req.body.password ? '***' : 'undefined');
```

### 4. Probar con Postman/Thunder Client
```json
POST http://localhost:4000/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "123456"
}
```

---

## 🎯 Errores Comunes

### Error 1: Falta Content-Type
```typescript
// ❌ MALO
fetch(url, {
  method: 'POST',
  body: JSON.stringify(data)  // Sin headers
});

// ✅ BUENO
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
```

### Error 2: Campo Incorrecto
```typescript
// ❌ Backend espera "email" pero envías "username"
body: JSON.stringify({ username, password })

// ✅ Envía lo que el backend espera
body: JSON.stringify({ email, password })
```

### Error 3: Validación Faltante
```typescript
// ❌ Enviar sin validar
login(email, password);

// ✅ Validar antes de enviar
if (!email || !password) {
  alert('Por favor ingresa email y contraseña');
  return;
}
if (!email.includes('@')) {
  alert('Email inválido');
  return;
}
login(email, password);
```

---

## 🚀 Código Completo Recomendado

### Frontend (auth-context.tsx)

```typescript
export const login = async (email: string, password: string) => {
  try {
    // Validación previa
    if (!email || !password) {
      throw new Error('Email y contraseña son requeridos');
    }

    console.log('🔐 Intentando login...');

    const response = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        email: email.trim(),      // Eliminar espacios
        password: password
      })
    });

    // Log del status
    console.log('📥 Status:', response.status);

    // Si no es 200-299
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Error del servidor:', errorData);
      throw new Error(errorData.message || `Error ${response.status}`);
    }

    // Parsear respuesta
    const data = await response.json();
    console.log('✅ Login exitoso');

    // Guardar token (ejemplo)
    if (data.token) {
      localStorage.setItem('authToken', data.token);
    }

    return data;

  } catch (error) {
    console.error('❌ Error en login:', error);
    throw error;
  }
};
```

### Backend (Node.js/Express ejemplo)

```javascript
const express = require('express');
const router = express.Router();

router.post('/auth/login', async (req, res) => {
  try {
    console.log('📥 Body recibido:', req.body);

    const { email, password } = req.body;

    // Validación
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos'
      });
    }

    // Validar formato email
    if (!email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Email inválido'
      });
    }

    // Buscar usuario (ejemplo con BD)
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Verificar contraseña
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Contraseña incorrecta'
      });
    }

    // Generar token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Login exitoso para:', email);

    res.json({
      success: true,
      token: token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      }
    });

  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;
```

---

## 📝 Notas Importantes

1. **Nunca envíes passwords en logs de producción**
2. **Usa HTTPS en producción** (no http://)
3. **Valida en frontend Y backend**
4. **Maneja errores apropiadamente**
5. **Usa tokens JWT para autenticación**

---

## 🔍 Depurar en Navegador

### 1. Abrir DevTools (F12)
### 2. Ir a "Network"
### 3. Reproducir el login
### 4. Click en la petición "login"
### 5. Ver en "Payload" qué se envió
### 6. Ver en "Response" qué respondió el servidor

---

**¿Necesitas más ayuda específica?** Comparte:
1. El código de `auth-context.tsx` línea 183
2. Lo que el backend espera recibir
3. El mensaje de error completo del backend
