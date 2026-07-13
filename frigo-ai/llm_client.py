"""
llm_client.py - Cliente para el LLM (Mistral en A100 via Ollama, o cualquier API compatible)

Genera respuestas de trazabilidad usando el contexto del RAG.
"""
import httpx
from config import LLM_API_URL, LLM_MODEL


SYSTEM_PROMPT = """Eres el auditor de calidad de Frigolab San Mateo, una planta procesadora de productos del mar.
Tu rol es analizar datos de trazabilidad de lotes de produccion y responder preguntas sobre ellos.

Reglas:
- Responde en espanol, de forma clara y profesional.
- Usa los datos proporcionados como contexto. No inventes datos que no esten en el contexto.
- Si se pide un reporte, usa vinetas o listas numeradas.
- Senala si hay anomalias (temperaturas fuera de rango, tiempos irregulares, firmas faltantes).
- Menciona los responsables (quien firmo cada control).
- Si no hay datos suficientes para responder, indicalo honestamente.
"""


async def generate_response(query: str, context: str, stream: bool = False) -> str:
    """
    Genera una respuesta usando el LLM con contexto de trazabilidad.

    Args:
        query: Pregunta del usuario
        context: Narrativa(s) de trazabilidad del RAG
        stream: Si usar streaming (para voice TTS)

    Returns:
        Respuesta del LLM como string
    """
    prompt = f"""CONTEXTO DE TRAZABILIDAD:
{context}

PREGUNTA DEL USUARIO:
{query}

Responde basandote exclusivamente en el contexto proporcionado."""

    payload = {
        "model": LLM_MODEL,
        "prompt": prompt,
        "system": SYSTEM_PROMPT,
        "stream": False,
        "options": {
            "temperature": 0.3,
            "top_p": 0.9,
            "num_predict": 1024,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(LLM_API_URL, json=payload)
            response.raise_for_status()
            data = response.json()
            return data.get("response", "No se obtuvo respuesta del modelo.")
    except httpx.ConnectError:
        return (
            "[ERROR] No se pudo conectar al LLM. "
            "Verifica que Ollama este corriendo con el modelo Mistral cargado. "
            "Comando: ollama run mistral"
        )
    except httpx.HTTPStatusError as e:
        return f"[ERROR] LLM respondio con error {e.response.status_code}: {e.response.text}"
    except Exception as e:
        return f"[ERROR] Error inesperado al consultar LLM: {e}"


async def generate_audit_report(lote_num: str, context: str) -> str:
    """
    Genera un reporte de auditoria estructurado para un lote.
    """
    query = (
        f"Genera un reporte de auditoria completo del lote {lote_num}. "
        f"Incluye: 1) Resumen del lote, 2) Cadena de custodia paso a paso, "
        f"3) Responsables y firmas, 4) Anomalias encontradas (si las hay), "
        f"5) Conclusion sobre el cumplimiento."
    )
    return await generate_response(query, context)
