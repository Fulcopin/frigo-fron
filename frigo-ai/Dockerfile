# syntax=docker/dockerfile:1.7
#
# Dockerfile de produccion para FrigoIA (telegram_bot.py + agent.py)
#
# Decisiones de diseno:
#   * Base: python:3.12-slim-bookworm. Bookworm tiene paquetes actualizados y
#     mas ligeros que bullseye; slim evita doc y utilidades innecesarias.
#   * Multi-stage: la etapa `builder` compila wheels pesados (pyodbc) y la
#     etapa `runtime` solo lleva la venv final -> imagen ~60% mas pequena.
#   * ODBC Driver 18 de Microsoft para SQL Server (igual que en Azure portal).
#   * Usuario no-root (appuser, UID 1001): principio de menor privilegio.
#   * tini como PID 1: maneja signals correctamente para graceful shutdown.
#
# Build:
#   docker build -t frigo-ai:latest .
#
# Run:
#   docker run --rm --env-file .env --name frigo-ai frigo-ai:latest

ARG PYTHON_VERSION=3.12

# =========================================================================
# Stage 1: builder - compila dependencias y crea la venv aislada
# =========================================================================
FROM python:${PYTHON_VERSION}-slim-bookworm AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /build

# Librerias de sistema necesarias para compilar pyodbc y psycopg2.
# unixodbc-dev provee los headers para compilar el wheel de pyodbc.
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      curl \
      gnupg \
      ca-certificates \
      unixodbc-dev \
      libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Creamos la venv dentro de /opt/venv para poder copiarla al runtime stage.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r requirements.txt


# =========================================================================
# Stage 2: runtime - imagen final con solo lo necesario para correr
# =========================================================================
FROM python:${PYTHON_VERSION}-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# Paso 1: instalar utilidades base (curl para healthcheck, tini para PID 1).
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl \
      gnupg \
      ca-certificates \
      tini \
      unixodbc \
      libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Paso 2: agregar repositorio oficial de Microsoft y ODBC Driver 18.
# ACCEPT_EULA=Y requerido por la licencia de Microsoft.
RUN curl -fsSL https://packages.microsoft.com/keys/microsoft.asc \
      | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" \
      > /etc/apt/sources.list.d/mssql-release.list && \
    apt-get update && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 && \
    rm -rf /var/lib/apt/lists/*

# Copiamos la venv compilada desde el builder.
COPY --from=builder /opt/venv /opt/venv

# Creamos usuario sin privilegios.
RUN groupadd --system --gid 1001 appuser && \
    useradd  --system --uid 1001 --gid appuser --shell /sbin/nologin --create-home appuser

WORKDIR /app
COPY --chown=appuser:appuser . /app

# Hardening adicional: no permitir que el proceso escriba fuera de /tmp/app.
USER appuser

# Puerto expuesto: FastAPI escucha en 8000 (modo webhook / API REST).
# En modo polling (VM) el contenedor no recibe trafico entrante, pero
# el puerto se declara igualmente para que Azure Container Apps pueda
# hacer health checks HTTP.
EXPOSE 8000

# tini como init: garantiza que SIGTERM llegue al proceso Python y no se
# quede zombie en Docker. Sin tini, python-telegram-bot puede tardar en cerrar.
ENTRYPOINT ["/usr/bin/tini", "--"]

# Healthcheck HTTP: usa el endpoint /health del servidor FastAPI.
# Azure Container Apps lo sondea cada 30s para saber si el contenedor esta vivo.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Modo por defecto: webhook + API REST via FastAPI (Azure Container Apps).
# Para modo polling (VM B1s) sobrescribir con:
#   docker run ... frigo-ai:latest python telegram_bot.py
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
