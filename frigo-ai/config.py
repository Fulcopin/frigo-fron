"""
config.py - Configuracion centralizada del sistema
"""
import os
from dotenv import load_dotenv

load_dotenv()

# API
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:5074/api")

# GitHub Models (LLM / Cerebro)
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_MODEL = os.getenv("GITHUB_MODEL", "gpt-4o-mini")

# Azure OpenAI — STT (Whisper)
AZURE_STT_KEY        = os.getenv("AZURE_STT_KEY")
AZURE_STT_ENDPOINT   = os.getenv("AZURE_STT_ENDPOINT")
AZURE_STT_DEPLOYMENT = os.getenv("AZURE_STT_DEPLOYMENT", "whisper")

# Azure OpenAI — TTS (gpt-4o-mini-tts)
AZURE_TTS_KEY        = os.getenv("AZURE_TTS_KEY")
AZURE_TTS_ENDPOINT   = os.getenv("AZURE_TTS_ENDPOINT")
AZURE_TTS_DEPLOYMENT = os.getenv("AZURE_TTS_DEPLOYMENT", "gpt-4o-mini-tts")

# Azure PostgreSQL (motor principal de produccion)
PG_DATABASE_URL = os.getenv("PG_DATABASE_URL")  # postgresql://user:pass@host:5432/db

# LangSmith — Observabilidad y trazas end-to-end
LANGSMITH_API_KEY = os.getenv("LANGSMITH_API_KEY")
LANGSMITH_PROJECT = os.getenv("LANGSMITH_PROJECT", "frigovoice-production")

# Mapeo de codigos de template a nombre legible (referencia informativa)
TEMPLATE_PROCESS_MAP = {
    "FOR-CC-42": "Recepcion de Materia Prima",
    "FOR-CC-20": "Control de Fileteo para Congelacion",
    "FOR-CC-10": "Control de Sellos (Empacado al Vacio)",
    "FOR-CC-06": "Control de Empaque Final",
    "FOR-CC-04": "Control de Temperatura en Camaras",
    "FOR-CC-08": "Control de Limpieza y Desinfeccion",
    "FOR-CC-12": "Control de Glaseo",
    "FOR-CC-14": "Control de Peso",
}


# SQL Server (pyodbc)
# IMPORTANTE: NO pongas credenciales reales aqui. Todas vienen de variables de
# entorno via .env (local) o secretos del orquestador (Docker/Kubernetes).
# SQL_DRIVER si puede tener un default razonable porque no es secreto.
SQL_SERVER   = os.getenv("SQL_SERVER")
SQL_DATABASE = os.getenv("SQL_DATABASE")
SQL_USER     = os.getenv("SQL_USER")
SQL_PASSWORD = os.getenv("SQL_PASSWORD")
SQL_DRIVER   = os.getenv("SQL_DRIVER", "ODBC Driver 18 for SQL Server")


def get_connection_string() -> str:
    """Devuelve el connection string pyodbc para SQL Server.

    Soporta dos modos de autenticacion:
      - SQL Login: si SQL_USER y SQL_PASSWORD estan definidos (Azure / login SQL).
      - Windows (Trusted_Connection): si NO hay usuario/clave — util cuando
        frigo-ai corre en el mismo servidor que SQLEXPRESS (FRIGO-INFORF).

    SQL_ENCRYPT / SQL_TRUST_CERT permiten conectar a un SQL Express local con
    certificado autofirmado (SQL_ENCRYPT=no o SQL_TRUST_CERT=yes).
    """
    driver   = os.getenv("SQL_DRIVER",   SQL_DRIVER)
    server   = os.getenv("SQL_SERVER")
    database = os.getenv("SQL_DATABASE")
    user     = os.getenv("SQL_USER")
    password = os.getenv("SQL_PASSWORD")
    encrypt  = os.getenv("SQL_ENCRYPT", "yes")
    trust    = os.getenv("SQL_TRUST_CERT", "no")

    missing = [
        name for name, value in (
            ("SQL_SERVER", server),
            ("SQL_DATABASE", database),
        )
        if not value
    ]
    if missing:
        raise EnvironmentError(
            f"Faltan variables de entorno SQL: {missing}. "
            "Configuralas en .env (desarrollo) o como secretos (produccion). "
            "Nunca deben estar hardcodeadas en el repo."
        )

    if user and password:
        auth = f"UID={user};PWD={password};"
    else:
        # Sin credenciales SQL → autenticacion de Windows (mismo servidor)
        auth = "Trusted_Connection=yes;"

    return (
        f"DRIVER={{{driver}}};"
        f"SERVER={server};"
        f"DATABASE={database};"
        f"{auth}"
        f"Encrypt={encrypt};TrustServerCertificate={trust};Connection Timeout=30;"
    )


def get_pg_dsn() -> str:
    """Devuelve el DSN de PostgreSQL. Lanza EnvironmentError si no esta configurado."""
    dsn = os.getenv("PG_DATABASE_URL")
    if not dsn:
        raise EnvironmentError(
            "PG_DATABASE_URL no esta definido en el archivo .env. "
            "Formato: postgresql://usuario:password@host:5432/nombre_base_de_datos"
        )
    return dsn
