# FrigoIA — Despliegue en Azure VM B1s (Ubuntu 22.04)

Guia paso a paso para subir el bot a una Maquina Virtual gratuita de Azure.
Esta opcion corre el bot **24/7** dentro del free tier de Azure for Students (750 h/mes).

---

## Arquitectura

```
Tu PC (Windows)
   │
   │  .\deploy\1-build-push.ps1
   │  (docker build + docker push)
   ▼
Docker Hub (gratis)
   │
   │  docker pull  (desde la VM)
   ▼
Azure VM B1s — Ubuntu 22.04
   │   ~/frigo-ai/.env.frigo  (credenciales, permisos 600)
   │   docker run --restart unless-stopped
   ▼
Contenedor frigo-ai
   ├──► Azure SQL Server  (picofrigo.database.windows.net)
   ├──► Azure OpenAI Whisper  (frigovoice-ai-hub)
   ├──► GitHub Models GPT-4o
   └──► Sentry (errores en produccion)
```

---

## Scripts disponibles

| Script | Donde ejecutar | Que hace |
|---|---|---|
| `1-build-push.ps1` | Tu PC (PowerShell) | Build Docker + push a Docker Hub |
| `2-setup-vm.sh` | VM Azure (una sola vez) | Instala Docker, crea estructura |
| `3-run-bot.sh` | VM Azure | Descarga imagen y arranca el bot |
| `4-update-bot.sh` | VM Azure | Actualiza el bot a nueva version |

---

## Paso a paso completo

### FASE 1 — Crear la VM en Azure Portal (5 min)

1. Ve a [portal.azure.com](https://portal.azure.com) → **Virtual Machines** → **Create**
2. Configuracion clave:
   - **Subscription**: Azure for Students
   - **Region**: East US *(o Central US si East US no tiene B1s disponible)*
   - **Image**: Ubuntu Server 22.04 LTS
   - **Size**: `Standard_B1s` (1 vCPU, 1 GiB RAM) — verifica que sea B1s no B1ls
   - **Authentication**: SSH public key
   - **Username**: `azureuser`
   - **Inbound ports**: SSH (22)
3. Haz clic en **Review + create** → **Create**
4. **Descarga el archivo `.pem`** cuando Azure te lo ofrezca. Guardalo en lugar seguro.
5. Anota la **IP publica** de la VM cuando termine de crearse.

---

### FASE 2 — Preparar Docker Hub (2 min)

1. Crea una cuenta gratuita en [hub.docker.com](https://hub.docker.com)
2. Anota tu usuario (ej. `miusuario`)

---

### FASE 3 — Build y push desde tu PC (3 min)

Abre PowerShell en la raiz del proyecto y ejecuta:

```powershell
.\deploy\1-build-push.ps1 -DockerUser tu_usuario_dockerhub
```

Esto construye la imagen y la sube a `docker.io/tu_usuario/frigo-bot:latest`.

Para una version especifica:
```powershell
.\deploy\1-build-push.ps1 -DockerUser tu_usuario_dockerhub -Tag v1.0.0
```

---

### FASE 4 — Conectarte a la VM (desde tu PC)

```powershell
# Windows PowerShell
ssh -i C:\ruta\a\tu-llave.pem azureuser@IP_PUBLICA_AZURE
```

Si Windows dice "permisos incorrectos" en el .pem:
```powershell
icacls "C:\ruta\a\tu-llave.pem" /inheritance:r /grant:r "$env:USERNAME:(R)"
```

---

### FASE 5 — Setup inicial de la VM (una sola vez, dentro de la VM)

```bash
# Desde dentro de la VM:
curl -fsSL https://raw.githubusercontent.com/TU_USUARIO/frigo-ai/main/deploy/2-setup-vm.sh | bash
```

O si prefieres copiar el script:
```bash
# Desde tu PC (PowerShell):
scp -i C:\ruta\llave.pem deploy\2-setup-vm.sh azureuser@IP_PUBLICA:~/
# Luego en la VM:
bash ~/2-setup-vm.sh
```

El script instala Docker y crea `~/frigo-ai/.env.frigo`.

---

### FASE 6 — Configurar las credenciales en la VM

```bash
# Dentro de la VM:
nano ~/frigo-ai/.env.frigo
```

Rellena todos los valores marcados con `CAMBIAR`:

```env
SQL_USER=fulo
SQL_PASSWORD=tu_password_real
GITHUB_TOKEN=ghp_tu_token_real
AZURE_STT_KEY=tu_llave_real
AZURE_STT_ENDPOINT=https://frigovoice-ai-hub.cognitiveservices.azure.com/
TELEGRAM_BOT_TOKEN=tu_token_real
SENTRY_DSN=tu_dsn_real
# ... etc
```

Guarda con `Ctrl+O`, cierra con `Ctrl+X`.

---

### FASE 7 — Arrancar el bot

```bash
# Copiar los scripts de deploy a la VM primero (desde tu PC):
scp -i C:\ruta\llave.pem deploy\3-run-bot.sh deploy\4-update-bot.sh \
    azureuser@IP_PUBLICA:~/frigo-ai/

# Dentro de la VM:
bash ~/frigo-ai/3-run-bot.sh TU_USUARIO_DOCKERHUB
```

Deberias ver:
```
[1/4] Descargando imagen desde Docker Hub... OK
[2/4] Deteniendo contenedor anterior (si existe)... No habia contenedor anterior
[3/4] Iniciando bot... Contenedor iniciado en background
[4/4] Verificando arranque (5 segundos)... Estado: RUNNING
============================================
  Bot desplegado correctamente.
============================================
```

---

## Operaciones del dia a dia

### Ver logs del bot en vivo
```bash
docker logs -f frigo-ai
```

### Ver estado del contenedor
```bash
docker ps
```

### Reiniciar el bot (sin cambiar imagen)
```bash
docker restart frigo-ai
```

### Actualizar a una nueva version
```bash
# En tu PC: construir y subir nueva version
.\deploy\1-build-push.ps1 -DockerUser tu_usuario_dockerhub -Tag v1.1.0

# En la VM: actualizar
bash ~/frigo-ai/4-update-bot.sh tu_usuario_dockerhub v1.1.0
```

### Detener el bot
```bash
docker stop frigo-ai
```

### Ver cuanto disco usa Docker
```bash
docker system df
```

### Limpiar imagenes viejas (liberar espacio en el disco de 30 GB)
```bash
docker image prune -f
```

---

## Monitoreo

- **Sentry**: abre [sentry.io](https://sentry.io) → Issues. Cada error del bot llega ahi con stack trace.
- **Logs de la VM**: `docker logs --tail 100 frigo-ai`
- **Metricas de la VM**: Azure Portal → tu VM → Monitoring → Metrics (CPU, red, disco)

---

## Preguntas frecuentes

### "El bot se cayo en la noche, que hago?"
Con `--restart unless-stopped` el bot se reinicia automaticamente si crashea.
Si la VM entera se reinicio (Azure la puede reiniciar por mantenimiento), el bot
vuelve a levantarse solo al arrancar Docker.

### "Pierdo las conversaciones si se reinicia?"
Con `CHECKPOINTER_BACKEND=memory` (el default): SI, las conversaciones en curso
se pierden. El bot vuelve a responder, pero sin contexto anterior.
Si quieres persistencia: agrega una Azure PostgreSQL y cambia a `CHECKPOINTER_BACKEND=postgres`.

### "Como cambio una variable de entorno sin rearmar la imagen?"
```bash
# En la VM:
nano ~/frigo-ai/.env.frigo  # editar
bash ~/frigo-ai/3-run-bot.sh TU_USUARIO_DOCKERHUB  # reiniciar con nuevos valores
```
No necesitas hacer docker build ni push.

### "Me quedo sin espacio en disco (30 GB)"
```bash
docker system prune -f       # elimina contenedores parados e imagenes sin tag
docker image prune -a -f     # elimina TODAS las imagenes no usadas (cuidado)
```

### "Cuantas horas gratis tengo en Azure Student?"
750 horas/mes para la B1s. El mes tiene ~720 horas, asi que cubre el 100%
si tienes solo esta VM corriendo.

### "Como hago SSH desde Windows sin el .pem cada vez?"
Agrega esto a `C:\Users\TU_USUARIO\.ssh\config`:
```
Host frigo-vm
    HostName IP_PUBLICA_AZURE
    User azureuser
    IdentityFile C:\ruta\a\tu-llave.pem
```
Luego: `ssh frigo-vm`
