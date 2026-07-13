# Desplegar FrigoIA en el servidor de Windows de la empresa (sin compilar)

Esta guía deja corriendo 24/7, como servicios de Windows:
- **FrigoIA-Bot** → `main.py` (bot de Telegram)
- **FrigoIA-Server** → `server.py` (API web que usa el botón 🤖 del sitio)

No se compila nada. Se copia el código Python tal cual y se ejecuta con un Python
instalado en el servidor. Es la forma más simple y confiable de mantenerlo:
para actualizar algo, solo reemplazas el archivo `.py` y reinicias el servicio.

---

## 0. Qué copiar al servidor

Copia TODA la carpeta `frigo-ai` (todos los `.py`, `requirements-lock.txt`, `.env`)
**excepto**: `venv/`, `__pycache__/`, `deploy/`, `.vscode/`, cualquier `*.log`.

La forma más fácil: comprime la carpeta en un `.zip` (clic derecho → Enviar a →
Carpeta comprimida) y pásala al servidor por USB, carpeta compartida de red, o
`\\` (recurso compartido de Windows). Luego descomprímela ahí, por ejemplo en:

```
C:\FrigoIA\
```

---

## 1. Prerrequisitos en el servidor de Windows

Instala estas 3 cosas en el servidor (una sola vez):

1. **Python 3.12** (64 bits) — descárgalo de https://www.python.org/downloads/
   Al instalar, marca la casilla **"Add python.exe to PATH"**.

2. **ODBC Driver 18 for SQL Server** (necesario para conectar a la base de datos)
   Descárgalo de: https://learn.microsoft.com/sql/connect/odbc/download-odbc-driver-for-sql-server
   (elige el instalador de 64 bits, "msodbcsql18...x64.msi")

3. **Microsoft Visual C++ Redistributable x64** (normalmente ya viene instalado
   en Windows Server, pero si algo falla al arrancar, instálalo desde
   https://aka.ms/vs/17/release/vc_redist.x64.exe)

---

## 2. Crear el entorno virtual e instalar dependencias

Abre **PowerShell como Administrador** en el servidor:

```powershell
cd C:\FrigoIA
python -m venv venv
.\venv\Scripts\pip install --upgrade pip
.\venv\Scripts\pip install -r requirements-lock.txt
```

Esto tarda unos minutos (instala FastAPI, LangChain, pyodbc, etc.).

---

## 3. Configurar el archivo .env

Abre `C:\FrigoIA\.env` con el Bloc de notas y revisa estas líneas clave:

```ini
# Si frigo-ai corre EN EL MISMO servidor que SQL Express y el backend .NET
# (lo más común — un solo servidor de planta):
SQL_SERVER=.\SQLEXPRESS
SQL_USER=
SQL_PASSWORD=
API_BASE_URL=http://localhost:8096/api

# Si frigo-ai corre en OTRA máquina de la red (no en el mismo servidor):
#SQL_SERVER=100.74.186.82\SQLEXPRESS   (o la IP que corresponda)
#SQL_USER=desarrollo
#SQL_PASSWORD=desa2020
#API_BASE_URL=http://100.74.186.82:8096/api
```

Deja `GITHUB_TOKEN`, `GROQ_API_KEY`, `TELEGRAM_TOKEN`, `AZURE_STT_KEY`, etc. tal
como están (ya son los reales del proyecto).

---

## 4. Probar manualmente ANTES de instalar como servicio

Muy importante: prueba que arrancan bien antes de convertirlos en servicio,
porque un servicio no te muestra la pantalla de errores.

**Terminal 1 — probar el bot:**
```powershell
cd C:\FrigoIA
.\venv\Scripts\python.exe main.py
```
Debe quedar esperando mensajes (sin errores). Prueba escribirle algo al bot
en Telegram. Detén con `Ctrl+C`.

**Terminal 2 — probar el servidor web:**
```powershell
cd C:\FrigoIA
.\venv\Scripts\python.exe server.py
```
Debe decir `Uvicorn running on http://0.0.0.0:8100`. Prueba en el navegador:
`http://localhost:8100/health` → debe responder `{"status":"ok",...}`.
Detén con `Ctrl+C`.

Si algo falla aquí, arréglalo antes de seguir (revisa el mensaje de error:
casi siempre es el `.env` con datos incorrectos, o falta el ODBC Driver 18).

---

## 5. Instalar como servicios de Windows (con NSSM)

NSSM mantiene los programas corriendo 24/7, los reinicia solos si se caen, y
arrancan automáticamente cuando el servidor se reinicia.

1. Descarga NSSM: https://nssm.cc/download (elige la versión más reciente)
2. Descomprime el `.zip` y copia `nssm.exe` (de la carpeta `win64`) a, por
   ejemplo, `C:\FrigoIA\nssm.exe`

**Servicio del bot de Telegram:**
```powershell
mkdir C:\FrigoIA\logs
C:\FrigoIA\nssm.exe install FrigoIA-Bot "C:\FrigoIA\venv\Scripts\python.exe" "C:\FrigoIA\main.py"
C:\FrigoIA\nssm.exe set FrigoIA-Bot AppDirectory "C:\FrigoIA"
C:\FrigoIA\nssm.exe set FrigoIA-Bot AppStdout "C:\FrigoIA\logs\bot.log"
C:\FrigoIA\nssm.exe set FrigoIA-Bot AppStderr "C:\FrigoIA\logs\bot.log"
C:\FrigoIA\nssm.exe set FrigoIA-Bot AppRotateFiles 1
C:\FrigoIA\nssm.exe set FrigoIA-Bot Start SERVICE_AUTO_START
C:\FrigoIA\nssm.exe start FrigoIA-Bot
```

**Servicio del servidor web (para el chat 🤖 del sitio):**
```powershell
C:\FrigoIA\nssm.exe install FrigoIA-Server "C:\FrigoIA\venv\Scripts\python.exe" "C:\FrigoIA\server.py"
C:\FrigoIA\nssm.exe set FrigoIA-Server AppDirectory "C:\FrigoIA"
C:\FrigoIA\nssm.exe set FrigoIA-Server AppStdout "C:\FrigoIA\logs\server.log"
C:\FrigoIA\nssm.exe set FrigoIA-Server AppStderr "C:\FrigoIA\logs\server.log"
C:\FrigoIA\nssm.exe set FrigoIA-Server AppRotateFiles 1
C:\FrigoIA\nssm.exe set FrigoIA-Server Start SERVICE_AUTO_START
C:\FrigoIA\nssm.exe start FrigoIA-Server
```

Verifica que ambos quedaron "Running": abre `services.msc` y busca
`FrigoIA-Bot` y `FrigoIA-Server`, o ejecuta:
```powershell
Get-Service FrigoIA-Bot, FrigoIA-Server
```

**Para actualizar código después:** reemplaza el `.py` modificado en
`C:\FrigoIA\` y reinicia el servicio afectado:
```powershell
C:\FrigoIA\nssm.exe restart FrigoIA-Server
```

**Para desinstalar un servicio** (si algo sale mal y quieres empezar de cero):
```powershell
C:\FrigoIA\nssm.exe stop FrigoIA-Server
C:\FrigoIA\nssm.exe remove FrigoIA-Server confirm
```

---

## 6. Abrir el puerto en el Firewall de Windows

Para que el sitio web (desde otras computadoras de la red) pueda llegar al
servidor web de la IA (puerto 8100):

```powershell
netsh advfirewall firewall add rule name="FrigoIA API 8100" dir=in action=allow protocol=TCP localport=8100
```

---

## 7. Apuntar el frontend al servidor

En el proyecto `frigo-fron`, edita `.env`:

```ini
VITE_AI_API_URL=http://<IP-DEL-SERVIDOR>:8100/api/ai
```

(reemplaza `<IP-DEL-SERVIDOR>` por la IP real del servidor en la red de planta,
por ejemplo `192.168.0.88`). Luego reinicia `npm run dev` o recompila con
`npm run build` según cómo despliegues el sitio.

---

## 8. Verificación final

Desde OTRA computadora de la red de planta (no el servidor):
```powershell
curl http://<IP-DEL-SERVIDOR>:8100/health
```
Debe responder `{"status":"ok",...}`. Si responde, abre el sitio web y prueba
el botón 🤖 — ya debería poder consultar rendimiento, observaciones, fórmulas,
lotes, etc. usando los datos reales del servidor.
