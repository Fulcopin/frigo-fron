# Despliegue de FrigoIA en produccion

Guia completa para subir el bot a un servidor con observabilidad (Sentry),
trazabilidad (LangSmith) y resiliencia (timeouts, retries, persistencia de
estado). Incluye la seccion "preguntas frecuentes" al final.

## 1. Arquitectura del despliegue

```
+-------------------+      +-----------------+      +-----------------+
|   Operarios       |      |  FrigoIA        |      |  Servicios      |
|   Telegram/Voz    |----> |  container      |----> |  externos       |
+-------------------+      |                 |      |                 |
                           |  telegram_bot   |      | - Azure SQL     |
                           |  agent (LLM)    |      | - Whisper STT   |
                           |  MCP server     |      | - LLM proxy     |
                           |                 |      |                 |
                           +--------+--------+      +-----------------+
                                    |
                 +------------------+--------------------+
                 |                  |                    |
           +-----v-----+      +-----v------+      +------v-------+
           | Postgres  |      |  Sentry    |      |  LangSmith   |
           | (estado)  |      |  (errores) |      |  (trazas)    |
           +-----------+      +------------+      +--------------+
```

Componentes nuevos tras este sprint:
- `db_utils.py`: capa compartida de DB con timeouts y retries.
- `tool_result.py`: contrato JSON `{status, code, message, data}` para todas las tools.
- `state_backends.py`: factory swappable de checkpointer (memory / postgres).
- `observability.py`: Sentry + metricas + spans.
- `Dockerfile`: imagen multi-stage con ODBC Driver 18 y usuario no-root.

## 2. Pre-requisitos

- Cuenta en tu proveedor de nube o servidor con Docker instalado.
- Acceso a Azure SQL Server (pueden ser las mismas credenciales existentes).
- (Opcional) DSN de Sentry: crea un proyecto Python en [sentry.io](https://sentry.io).
- (Opcional) API key de [LangSmith](https://smith.langchain.com) para trazas del LLM.
- (Opcional) Postgres para persistir estado conversacional.

## 3. Variables de entorno criticas

Copia `.env.example` a `.env` y llena al menos estas:

| Variable | Obligatorio | Por que |
|---|---|---|
| `SQL_SERVER`, `SQL_DATABASE`, `SQL_USER`, `SQL_PASSWORD` | Si | Sin estas el proceso NO arranca (fail-fast). |
| `TELEGRAM_BOT_TOKEN` | Si | Token del bot @BotFather. |
| `GITHUB_TOKEN` | Si | Auth para GitHub Models (LLM). |
| `AZURE_STT_KEY`, `AZURE_STT_ENDPOINT` | Si | Para notas de voz. |
| `SENTRY_DSN` | No | Activa reporte de errores. |
| `LANGSMITH_API_KEY` | No | Activa trazas detalladas del LLM. |
| `CHECKPOINTER_BACKEND=postgres` + `PG_DATABASE_URL` | No | Persiste estado conversacional entre reinicios. |

## 4. Build y run local con Docker

```bash
docker build -t frigo-ai:latest .

docker run --rm \
  --name frigo-ai \
  --env-file .env \
  frigo-ai:latest
```

Logs esperados al arrancar:
```
Observability: Sentry activo (env=production, release=frigo-ai@1.0.0, traces=0.10)
Observability: LangSmith activo -> proyecto 'frigovoice-production'
state_backends: usando MemorySaver (backend=memory)
FrigoVoice Telegram Bot iniciado. Esperando mensajes...
```

Si ves `Observability: Sentry no configurado`, no hay DSN: Sentry queda apagado
pero el bot funciona normalmente.

## 5. Deploy a un servidor

### Opcion A: Railway / Fly.io / Render

1. Subir el repo a GitHub.
2. Conectar el proyecto a la plataforma y seleccionar "Deploy from Dockerfile".
3. Definir las variables de entorno desde el panel de la plataforma (NO subir el `.env` al repo).
4. La plataforma construye la imagen y la expone. No necesitas hacer mas nada.

### Opcion B: VPS con Docker + systemd

1. Instalar Docker en el VPS.
2. Clonar el repo en `/opt/frigo-ai` y crear `.env` (modo 600, solo root).
3. Crear `/etc/systemd/system/frigo-ai.service`:

```ini
[Unit]
Description=FrigoIA Telegram Bot
After=docker.service
Requires=docker.service

[Service]
Restart=always
RestartSec=10
ExecStartPre=-/usr/bin/docker stop frigo-ai
ExecStartPre=-/usr/bin/docker rm frigo-ai
ExecStartPre=/usr/bin/docker build -t frigo-ai:latest /opt/frigo-ai
ExecStart=/usr/bin/docker run --rm --name frigo-ai --env-file /opt/frigo-ai/.env frigo-ai:latest
ExecStop=/usr/bin/docker stop frigo-ai

[Install]
WantedBy=multi-user.target
```

4. `systemctl enable --now frigo-ai`.

### Opcion C: Kubernetes (escala horizontal)

Solo si necesitas alta disponibilidad. Activa `CHECKPOINTER_BACKEND=postgres`
para compartir estado entre replicas. Crea un `Secret` para las credenciales
y un `Deployment` con `replicas: 2+`.

## 6. Validacion post-despliegue

Lista de chequeo al levantar un entorno nuevo:

- [ ] `docker logs frigo-ai` muestra "Telegram Bot iniciado".
- [ ] Enviar `/start` al bot en Telegram responde en menos de 2s.
- [ ] Preguntar "Que formularios tengo?" -> el bot responde con la lista real.
- [ ] Provocar un error (apagar Azure SQL momentaneamente): las tools deben
      responder con `status: error, code: DB_UNAVAILABLE` en lugar de colgar.
- [ ] Si Sentry esta activado, el error aparece en sentry.io (busca `environment=production`).
- [ ] Si LangSmith esta activado, la traza del request aparece en smith.langchain.com.
- [ ] Reiniciar el contenedor. Si CHECKPOINTER_BACKEND=postgres, un operario
      que estaba en medio de una conversacion puede continuar. Si esta en
      memory, debe empezar de cero (comportamiento esperado).

## 7. Operaciones comunes

- Ver metricas en caliente:
  ```python
  from observability import dump_metrics
  print(dump_metrics())
  ```
  Puedes exponer esto en un endpoint `/health` si agregas FastAPI al contenedor.
- Cambiar de MemorySaver a Postgres sin rebuild:
  ```bash
  docker run -e CHECKPOINTER_BACKEND=postgres -e PG_DATABASE_URL=... frigo-ai:latest
  ```
- Ajustar timeouts en caliente (ejemplo para SQL mas agresivo):
  ```bash
  docker run -e SQL_TIMEOUT_SECONDS=10 -e SQL_MAX_RETRIES=2 frigo-ai:latest
  ```

## 8. Preguntas frecuentes que probablemente tendras

### "Por que el mensaje del operario NO se envia a Sentry?"
Deliberadamente: los mensajes de los operarios son datos operativos potencialmente
sensibles (lotes, pesos, temperaturas, identidades). En `observability._sentry_before_send`
filtramos antes de enviar. Solo se envian stack traces y tags tecnicos (chat_id,
tool_name, error_code). Si quieres adjuntar mensajes para debugging puntual, usalo
como `extra` en un `log_error(...)` controlado.

### "El bot respondio mal ante un error: simulo datos cuando la BD estaba caida"
Esto es un problema del SYSTEM_PROMPT, no del codigo. Con las tools devolviendo
JSON `{status:error, code:DB_UNAVAILABLE}`, el prompt YA instruye al modelo a
NO inventar datos. Si aun asi pasa:
1. Revisa en LangSmith la traza: el ToolMessage deberia decir `"status":"error"`.
2. Si el ToolMessage es correcto pero el LLM lo ignora, el modelo (gpt-4o-mini)
   puede no estar siguiendo instrucciones. Sube a `gpt-4o` cambiando `GITHUB_MODEL`.
3. Como ultima opcion, agrega una guardia en `tools_node`: si cualquier tool
   devolvio `status:error` transitorio, corta el ciclo y responde al operario
   con un mensaje fijo ("servicio momentaneamente indisponible").

### "Cuanto me cuesta cada mensaje del operario?"
Con las optimizaciones actuales (MAX_CONTEXT_TOKENS=8000, LLM cacheado,
trim automatico):
- Un mensaje simple ("que formularios tengo"): 1 llamada al LLM, ~1k tokens.
- Una trazabilidad de lote: 2-3 llamadas (LLM + tool + LLM), ~3-5k tokens.
- Si GITHUB_MODEL=gpt-4o-mini: centavos de USD por mensaje.
- Si GITHUB_MODEL=gpt-4o: 10-20x mas caro. Usalo solo si gpt-4o-mini da respuestas
  malas en produccion.

### "Por que no usaron un pool de conexiones pyodbc?"
pyodbc NO tiene pool nativo. En Python las opciones son:
- `aioodbc` + pool asyncio: alternativa solida pero requiere refactor de
  `db_utils.run_sql` para que no use `asyncio.to_thread`.
- `SQLAlchemy` async: demasiado overhead para 8 queries.
- `threading.local` con conexiones reutilizables: funciona, pero agrega
  complejidad por thread-safety.

Con ~20 operarios concurrentes y <10 queries/minuto, abrir/cerrar conexion por
query (~300ms handshake) es aceptable. Si el volumen crece, migrar a `aioodbc`
es el siguiente paso; el contrato de `db_utils.run_sql` queda igual.

### "Que pasa si Azure SQL esta caido?"
Cada query intenta 3 veces con backoff exponencial (0.5s, 1s, 2s). Si todas
fallan, la tool devuelve `status:error, code:DB_UNAVAILABLE`. El SYSTEM_PROMPT
instruye al LLM a informar al operario de forma clara y no inventar datos.
Sentry recibe un evento para que el equipo de infra reaccione. El bot NO se
cae: sigue respondiendo a otros operarios y a mensajes que no requieran SQL.

### "Si reinicio el contenedor, los operarios pierden el hilo de la conversacion?"
- Con `CHECKPOINTER_BACKEND=memory` (default): SI. Todos empiezan de cero.
- Con `CHECKPOINTER_BACKEND=postgres`: NO. El estado persiste. Si un operario
  estaba contestando un interrupt, al volver el contenedor puede seguir.
  Recomendado para produccion.

### "Como hago rollback si subo una version mala?"
1. Taguea cada imagen: `docker build -t frigo-ai:v1.2.3 .`
2. Guarda la imagen anterior antes de desplegar: `docker tag frigo-ai:prod frigo-ai:prev`
3. Si algo sale mal: `docker run frigo-ai:prev` y listo.
4. En Kubernetes: `kubectl rollout undo deployment/frigo-ai`.

### "Cuales son las siguientes mejoras (sprint 2)?"
Con el estado actual ya estas en territorio Senior. Cosas que quedan:
1. **Tests de integracion con mocks** (pytest + pytest-asyncio + aioresponses).
   Mockear pyodbc y httpx para validar retry/timeout sin tocar produccion.
2. **Connection pool real para pyodbc** si el volumen supera 50 QPS.
3. **Redis para `_pending_resume`** en telegram_bot si escalas a multiples replicas.
4. **Endpoint `/metrics`** que exponga `dump_metrics()` en formato Prometheus.
5. **Circuit breaker para el LLM**: si Azure OpenAI esta caido por 5 min, cortar
   y responder "servicio de IA temporalmente indisponible" sin consumir tokens
   en reintentos.
6. **Migracion a `aioodbc`** si la latencia del handshake TLS de SQL Server
   se vuelve dominante (raro).

### "Podes auditar todas las queries SQL que hizo el bot hoy?"
Si: LangSmith graba cada ToolMessage (incluye el `data` con detalles de la
query). Ademas los contadores `frigo.tool.call{tool=rastrear_lote}` dan
volumen agregado. Para queries crudas, activa logging DEBUG en `db_utils.run_sql`
y redirige a stdout / CloudWatch / Loki.

### "Como evito que un operario malicioso saque datos sensibles?"
- La arquitectura MCP ya hace de gatekeeper: el LLM no accede a la BD
  directamente, solo puede llamar tools con parametros controlados.
- Ningun tool permite SQL crudo: todo es parametrizado con `cur.execute(..., [params])`.
- Las queries son read-only salvo `guardar_borrador` (write controlado).
- Activar `ALLOWED_CHAT_IDS` en `telegram_bot.py` para whitelist de operarios autorizados.
- Las transcripciones de voz NO se guardan mas alla del mensaje actual.
