"""
multi_agent.py - Arquitectura Multi-Agente para FrigoIA

Un Supervisor LLM enruta cada mensaje al agente especializado más adecuado.
Cada sub-agente tiene su propio conjunto de herramientas y prompt optimizado
para su dominio, reduciendo la ventana de contexto y mejorando la precisión.

Arquitectura:
                        ┌─────────────────────────────────────────────────┐
    Mensaje usuario     │                  SUPERVISOR                      │
    ──────────────► ───►│  GPT-4o decide: trazabilidad | formularios |    │
                        │  analisis | directo (sin sub-agente)             │
                        └────────────┬────────────┬───────────────────────┘
                                     │            │
                       ┌─────────────┘            └──────────────┐
                       ▼                                          ▼
           ┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
           │  TRAZABILIDAD      │   │  FORMULARIOS       │   │  ANÁLISIS          │
           │  rastrear_lote     │   │  obtener_esquema   │   │  estadisticas      │
           │  analizar_brecha   │   │  guardar_borrador  │   │  analizar_datos    │
           │  listar_lotes      │   │  pedir_dato        │   │  resumen_negocio   │
           └────────────────────┘   └────────────────────┘   │  analizar_foto     │
                                                              └────────────────────┘

Uso desde telegram_bot.py / server.py:
    from multi_agent import run_multi_agent, get_multi_graph

    result = await run_multi_agent(
        chat_id=12345,
        user_message="rastrear el lote ABC-001",
    )
    print(result["response"])

Activación:
    Definir la variable de entorno MULTI_AGENT=true en .env para que
    telegram_bot.py use el grafo multi-agente en lugar del agente único.
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
from typing import Annotated, Any, Literal, TypedDict

from dotenv import load_dotenv
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
    trim_messages,
)
from langchain_core.messages.utils import count_tokens_approximately
from langchain_core.tools import tool
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from langgraph.types import Command, interrupt

load_dotenv()
log = logging.getLogger(__name__)


# =============================================================================
# Importaciones desde el proyecto existente
# =============================================================================

from agent import (
    _build_llm,
    _get_bound_llm,
    _llm_ainvoke_with_retry,
    _now_str,
    _truncate_tool_messages,
    _context_trimmer,
    _GRAPH_TOOLS,
    pedir_dato_al_operario,
    MAX_CONTEXT_TOKENS,
    mcp_is_active,
)
from sql_tools import (
    rastrear_lote_tool,
    obtener_esquema_formulario_tool,
    guardar_borrador_tool,
    estadisticas_formularios_tool,
    analizar_datos_formulario_tool,
    listar_lotes_tool,
    analizar_brecha_lote_tool,
    analizar_foto_etiqueta_tool,
    resumen_negocio_tool,
    analizar_rendimiento_tool,
    calcular_formula_tool,
    revisar_observaciones_tool,
)
from state_backends import get_checkpointer


# =============================================================================
# Estado compartido
# =============================================================================

class MultiAgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    active_agent: str   # "supervisor" | "trazabilidad" | "formularios" | "analisis"
    handoff_count: int  # evita loops infinitos entre agentes


# Máximo de handoffs por turno (protección anti-loop)
_MAX_HANDOFFS = 3


# =============================================================================
# Herramientas por sub-agente
# =============================================================================

TOOLS_TRAZABILIDAD = [
    rastrear_lote_tool,
    analizar_brecha_lote_tool,
    listar_lotes_tool,
]

TOOLS_FORMULARIOS = [
    obtener_esquema_formulario_tool,
    guardar_borrador_tool,
    pedir_dato_al_operario,
]

TOOLS_ANALISIS = [
    estadisticas_formularios_tool,
    analizar_datos_formulario_tool,
    resumen_negocio_tool,
    analizar_foto_etiqueta_tool,
    analizar_rendimiento_tool,
    calcular_formula_tool,
    revisar_observaciones_tool,
    obtener_esquema_formulario_tool,  # ver campos/columnas de un formulario
]


# =============================================================================
# System prompts por sub-agente
# =============================================================================

_BASE_RULES = """
REGLA CRITICA: Nunca respondas de memoria o inventes datos. SIEMPRE usa las herramientas.
Si no tienes herramienta para responder algo, di que no puedes ayudar con eso en este contexto.
Responde siempre en español, breve y profesional. Sin markdown, sin tablas."""

SUPERVISOR_SYSTEM = """Eres el coordinador del sistema FrigoIA de Frigolab San Mateo.
Tu única tarea es decidir qué agente especializado debe manejar la solicitud del operario.

Agentes disponibles:
  - trazabilidad: para preguntas sobre lotes, rastreo, etapas, brechas de QC.
  - formularios:  para llenar, guardar o consultar esquemas de formularios de QC.
  - analisis:     para estadísticas, KPIs, reportes, RENDIMIENTO, cálculos y fórmulas
                  entre columnas (promedio/máximo/suma de una columna), observaciones
                  y novedades de los operarios, fotos de etiquetas, resumen del día.
  - directo:      para saludos, preguntas fuera de dominio, o respuestas simples sin tools.

Responde ÚNICAMENTE con una de estas palabras: trazabilidad | formularios | analisis | directo
No expliques tu razonamiento. Solo devuelve la palabra."""

TRAZABILIDAD_SYSTEM = f"""Eres el agente de Trazabilidad de FrigoIA en Frigolab San Mateo.
Especializas en el seguimiento de lotes de producción.

Flujo de producción (orden obligatorio):
1. Fileteo (FOR-PD-04)
2. Liberación de Túnel (FOR-PD-05)
3. Corte y Empaque (FOR-PD-06)
4. Control de Sellos (FOR-CC-10)
Un lote COMPLETO tiene registro en las 4 etapas. Si falta alguna, hay una brecha de QC.

Herramientas disponibles:
- rastrear_lote_tool: historia cronológica completa de un lote.
- analizar_brecha_lote_tool: qué etapas le faltan a un lote.
- listar_lotes_tool: lista de lotes por rango de fechas.

Temperatura: Congelados ≤ -18°C. Frío ≤ 4°C. Si hay valores fuera, inicia con ALERTA.

Fecha y hora: {{fecha}}
{_BASE_RULES}"""

FORMULARIOS_SYSTEM = f"""Eres el agente de Formularios de FrigoIA en Frigolab San Mateo.
Especializas en el ingreso de datos QC por voz y gestión de borradores.

Flujo de llenado:
1. Usa obtener_esquema_formulario_tool para conocer los campos del formulario.
2. Si faltan datos obligatorios, usa pedir_dato_al_operario para pedirlos (NO inventes).
3. Con todos los datos, usa guardar_borrador_tool.

Herramientas disponibles:
- obtener_esquema_formulario_tool: esquema JSON con campos y reglas del formulario.
- guardar_borrador_tool: guarda el borrador en el sistema con los datos del operario.
- pedir_dato_al_operario: pausa el flujo y pide un dato específico al operario.

Fecha y hora: {{fecha}}
{_BASE_RULES}"""

ANALISIS_SYSTEM = f"""Eres el agente de Análisis de FrigoIA en Frigolab San Mateo.
Especializas en estadísticas, KPIs, rendimiento, cálculos personalizados y reportes.

Herramientas disponibles:
- resumen_negocio_tool: dashboard diario/semanal con KPIs de producción.
- estadisticas_formularios_tool: porcentajes de cumplimiento por formulario.
- analizar_datos_formulario_tool: análisis de valores dentro de un tipo de formulario.
- analizar_rendimiento_tool: rendimiento (yield %) por fechas, mejor/peor día, por producto.
- calcular_formula_tool: cálculos personalizados entre columnas. Formula con columnas
  ENTRE CORCHETES: "[Peso Neto] / [Peso Recibido] * 100" o "SUM([Cantidad])".
  Funciones: SUM, PROM, MIN, MAX, COUNT. Si una columna no existe, la herramienta
  devuelve las disponibles: reintenta con el nombre correcto.
- revisar_observaciones_tool: observaciones y novedades escritas por los operarios.
- obtener_esquema_formulario_tool: campos y columnas que tiene un formulario.
- analizar_foto_etiqueta_tool: visión computacional en fotos de etiquetas/productos.

Si piden "todos los detalles" o "informacion" de un formulario (ej. FOR-CC-17):
usa analizar_datos_formulario_tool (contenido/valores) y si preguntan por sus
campos usa obtener_esquema_formulario_tool.

FECHAS: para rangos relativos ("últimos 15 días", "esta semana"=7, "este mes"=30)
NO calcules fechas: pasa ultimos_dias="N" y deja fecha_desde/fecha_hasta vacíos.
Solo usa fechas YYYY-MM-DD cuando el usuario dé fechas concretas (nunca futuras).

Fecha y hora: {{fecha}}
{_BASE_RULES}"""


# =============================================================================
# Nodo Supervisor — decide el enrutamiento
# =============================================================================

# Enrutamiento determinista por palabras clave: mas preciso que el LLM para
# los casos frecuentes y ahorra una llamada LLM por turno (menos TPM en Groq).
# ANALISIS va primero: "observaciones del FOR-CC-11" debe ir a analisis aunque
# mencione un codigo de formulario.
_KW_ANALISIS = (
    "observacion", "novedad", "incidencia", "rendimiento", "yield", "promedio",
    "maximo", "minimo", "suma de", "sumar", "calcula", "formula", "columna",
    "estadistic", "kpi", "dashboard", "resumen", "cumplimiento", "reporte",
    "glaseo", "eficiencia", "perdida",
)
_KW_TRAZABILIDAD = ("trazabilidad", "rastrea", "rastrear", "brecha", "etapa", "lote")
_KW_FORMULARIOS = ("llenar", "borrador", "registrar", "esquema", "iniciar control", "guardar")


def _normalizar_routing(texto: str) -> str:
    import unicodedata
    t = unicodedata.normalize("NFD", (texto or "").lower())
    return "".join(c for c in t if unicodedata.category(c) != "Mn")


def _ruta_por_keywords(texto: str) -> str | None:
    t = _normalizar_routing(texto)
    if any(k in t for k in _KW_ANALISIS):
        return "analisis"
    tiene_traza = any(k in t for k in _KW_TRAZABILIDAD)
    # Pregunta sobre un formulario concreto (FOR-CC-17, for pd 04...) sin
    # intencion de lote/trazabilidad → es analisis de datos del formulario
    if re.search(r"\bfor[\s-]?[a-z]{2}[\s-]?\d+", t) and not tiene_traza:
        return "analisis"
    if tiene_traza:
        return "trazabilidad"
    if any(k in t for k in _KW_FORMULARIOS):
        return "formularios"
    return None


async def supervisor_node(state: MultiAgentState) -> Command:
    """Analiza el último mensaje y decide qué sub-agente debe responder."""
    handoff_count = state.get("handoff_count", 0)
    if handoff_count >= _MAX_HANDOFFS:
        log.warning("multi_agent: máximo de handoffs (%d) alcanzado, respondiendo directamente.", _MAX_HANDOFFS)
        return Command(goto="direct_agent", update={"active_agent": "directo", "handoff_count": handoff_count + 1})

    # Usar el último mensaje humano para el routing
    last_human = next(
        (m for m in reversed(state["messages"]) if isinstance(m, HumanMessage)),
        None,
    )
    if not last_human:
        return Command(goto=END)

    # 1) Ruta determinista por palabras clave (sin gastar LLM)
    ruta_kw = _ruta_por_keywords(str(last_human.content))
    if ruta_kw:
        log.info("multi_agent supervisor (keywords): '%s' → %s", str(last_human.content)[:60], ruta_kw)
        return Command(
            goto=f"{ruta_kw}_agent",
            update={"active_agent": ruta_kw, "handoff_count": handoff_count + 1},
        )

    # 2) Ruta por LLM para casos ambiguos
    supervisor_llm = _build_llm(temperature=0.0)
    try:
        result = await supervisor_llm.ainvoke([
            SystemMessage(content=SUPERVISOR_SYSTEM),
            HumanMessage(content=last_human.content),
        ])
        decision = result.content.strip().lower()
        log.info("multi_agent supervisor: '%s' → %s", str(last_human.content)[:60], decision)
    except Exception as exc:
        log.error("multi_agent: supervisor LLM falló: %s — usando trazabilidad como fallback", exc)
        decision = "trazabilidad"

    route_map = {
        "trazabilidad": "trazabilidad_agent",
        "formularios":  "formularios_agent",
        "analisis":     "analisis_agent",
        "directo":      "direct_agent",
    }
    next_node = route_map.get(decision, "trazabilidad_agent")
    return Command(
        goto=next_node,
        update={"active_agent": decision, "handoff_count": handoff_count + 1},
    )


# =============================================================================
# Fábrica genérica de nodos de sub-agente
# =============================================================================

def _sanitizar_historial(messages: list[BaseMessage]) -> list[BaseMessage]:
    """Convierte los turnos ANTERIORES con tool calls en texto plano.

    Por qué: la memoria de sesión mezcla turnos de distintos sub-agentes. Si el
    agente de trazabilidad ve en el historial un tool_call de
    revisar_observaciones_tool (del agente de análisis), el modelo lo imita y
    Groq rechaza la petición ("tool not in request.tools") → error al usuario.
    Solución: todo lo anterior al último mensaje humano se aplana a texto;
    el turno ACTUAL (desde el último HumanMessage) se conserva intacto para
    que el ciclo tool-call → tool-result del propio agente funcione.
    """
    last_h = max(
        (i for i, m in enumerate(messages) if isinstance(m, HumanMessage)),
        default=-1,
    )
    out: list[BaseMessage] = []
    for i, m in enumerate(messages):
        if i >= last_h:
            out.append(m)
            continue
        if isinstance(m, AIMessage) and getattr(m, "tool_calls", None):
            nombres = ", ".join(tc.get("name", "?") for tc in m.tool_calls)
            out.append(AIMessage(content=str(m.content) or f"(consulte la herramienta {nombres})"))
        elif isinstance(m, ToolMessage):
            out.append(AIMessage(content=f"(dato consultado) {str(m.content)[:400]}"))
        else:
            out.append(m)
    return out


def _make_agent_node(agent_tools: list, system_template: str, node_name: str):
    """Crea un nodo de sub-agente con tools y system prompt específicos.

    Reutiliza los mismos patrones del agente principal (trimming, retry, cache).
    """
    async def _agent_node(state: MultiAgentState) -> dict:
        system_content = system_template.replace("{fecha}", _now_str())
        system = SystemMessage(content=system_content)

        # ORDEN CRITICO: truncar los ToolMessages gigantes PRIMERO y despues
        # recortar el contexto. Al reves, el trimmer ve un ToolMessage enorme
        # que excede el budget, descarta TODO el historial y el LLM responde
        # un saludo generico ignorando la pregunta y el resultado de la tool.
        pre_truncated = _truncate_tool_messages(_sanitizar_historial(state["messages"]))
        try:
            trimmed = _context_trimmer.invoke(pre_truncated)
        except Exception:
            trimmed = pre_truncated[-10:]
        if not trimmed:
            # Fallback: nunca invocar al LLM sin contexto minimo
            trimmed = pre_truncated[-4:]

        try:
            llm = await _get_bound_llm(agent_tools, temperature=0.1)
            response = await _llm_ainvoke_with_retry(llm, [system] + trimmed)
        except Exception as exc:
            log.error("multi_agent %s: LLM falló: %s", node_name, exc, exc_info=True)
            response = AIMessage(
                content="Tuve un problema momentáneo. Por favor intenta de nuevo en unos segundos."
            )

        return {"messages": [response]}

    _agent_node.__name__ = f"{node_name}_node"
    return _agent_node


def _make_tools_node(agent_tools: list, node_name: str):
    """Crea un nodo ejecutor de tools para un sub-agente."""
    tool_map = {t.name: t for t in agent_tools}

    async def _tools_node(state: MultiAgentState) -> dict:
        last = state["messages"][-1]
        tool_calls = getattr(last, "tool_calls", []) or []
        results: list[BaseMessage] = []

        for tc in tool_calls:
            if tc["name"] == "pedir_dato_al_operario":
                continue
            fn = tool_map.get(tc["name"])
            if fn is None:
                from tool_result import err as _err
                content = _err(
                    "TOOL_NOT_FOUND",
                    f"La herramienta '{tc['name']}' no existe en este agente ({node_name}).",
                )
            else:
                try:
                    content = await fn.ainvoke(tc["args"])
                except Exception as exc:
                    from tool_result import err as _err
                    log.error("multi_agent %s: tool %s falló: %s", node_name, tc["name"], exc)
                    content = _err("TOOL_CRASH", f"La herramienta {tc['name']} falló: {exc}")
            results.append(ToolMessage(content=str(content), tool_call_id=tc["id"]))

        return {"messages": results}

    _tools_node.__name__ = f"{node_name}_tools_node"
    return _tools_node


def _make_ask_human_node():
    """Nodo de interrupción para el agente de formularios (pedir datos faltantes)."""
    def _ask_human_node(state: MultiAgentState) -> dict:
        last = state["messages"][-1]
        tool_calls = getattr(last, "tool_calls", []) or []

        campo, pregunta, call_id = "dato", "Necesito un dato adicional.", "unknown"
        for tc in tool_calls:
            if tc["name"] == "pedir_dato_al_operario":
                campo = tc["args"].get("campo", campo)
                pregunta = tc["args"].get("pregunta", pregunta)
                call_id = tc["id"]
                break

        raw = interrupt(pregunta)
        texto = "" if raw is None else str(raw).strip()[:500]

        if not texto:
            from tool_result import empty as _empty
            content = _empty(
                f"El operario no proporcionó '{campo}'. Reformula la pregunta.",
                {"campo": campo},
            )
        else:
            from tool_result import ok as _ok
            content = _ok(
                f"El operario respondió sobre '{campo}': {texto}",
                {"campo": campo, "valor": texto},
                code="HUMAN_ANSWER",
            )
        return {"messages": [ToolMessage(content=content, tool_call_id=call_id)]}

    return _ask_human_node


# =============================================================================
# Routers de nodos de sub-agente
# =============================================================================

def _make_router(tools_node_name: str, ask_human_node_name: str | None = None):
    """Router genérico: decide si ir a tools, ask_human o END."""
    def _router(state: MultiAgentState) -> str:
        last = state["messages"][-1]
        if not isinstance(last, AIMessage):
            return END
        tool_calls = getattr(last, "tool_calls", []) or []
        if not tool_calls:
            return END
        if ask_human_node_name:
            for tc in tool_calls:
                if tc["name"] == "pedir_dato_al_operario":
                    return ask_human_node_name
        return tools_node_name

    return _router


# =============================================================================
# Agente directo (respuestas sin tools — saludos, fuera de dominio)
# =============================================================================

DIRECT_SYSTEM = f"""Eres FrigoIA, el asistente de control de calidad de Frigolab San Mateo.
Responde directamente sin usar herramientas. Si el operario hace preguntas de negocio
(lotes, formularios, estadísticas), indícale que puede preguntarte directamente y lo ayudarás.
Fecha y hora: {{fecha}}
{_BASE_RULES}"""

async def direct_agent_node(state: MultiAgentState) -> dict:
    """Responde directamente sin tools (saludos, fuera de dominio)."""
    system = SystemMessage(content=DIRECT_SYSTEM.replace("{fecha}", _now_str()))
    try:
        trimmed = state["messages"][-6:]  # contexto mínimo para respuestas directas
        llm = _build_llm(temperature=0.2)
        response = await llm.ainvoke([system] + trimmed)
    except Exception as exc:
        log.error("multi_agent direct_agent: LLM falló: %s", exc)
        response = AIMessage(content="Hola, soy FrigoIA. ¿En qué puedo ayudarte?")
    return {"messages": [response]}


# =============================================================================
# Construcción del grafo multi-agente
# =============================================================================

_multi_graph = None


def get_multi_graph():
    """Construye y cachea el grafo multi-agente.

    Topología del grafo:
        supervisor → trazabilidad_agent → trazabilidad_tools → trazabilidad_agent → END
                   → formularios_agent  → formularios_tools  → ...
                   → formularios_ask_human → formularios_agent → ...
                   → analisis_agent     → analisis_tools     → analisis_agent → END
                   → direct_agent       → END
    """
    global _multi_graph
    if _multi_graph is not None:
        return _multi_graph

    # Crear nodos de sub-agentes
    traz_agent = _make_agent_node(TOOLS_TRAZABILIDAD, TRAZABILIDAD_SYSTEM, "trazabilidad")
    traz_tools = _make_tools_node(TOOLS_TRAZABILIDAD, "trazabilidad")

    form_agent = _make_agent_node(TOOLS_FORMULARIOS, FORMULARIOS_SYSTEM, "formularios")
    form_tools = _make_tools_node(TOOLS_FORMULARIOS, "formularios")
    form_ask = _make_ask_human_node()

    anal_agent = _make_agent_node(TOOLS_ANALISIS, ANALISIS_SYSTEM, "analisis")
    anal_tools = _make_tools_node(TOOLS_ANALISIS, "analisis")

    # Routers
    traz_router = _make_router("trazabilidad_tools")
    form_router = _make_router("formularios_tools", "formularios_ask_human")
    anal_router = _make_router("analisis_tools")

    builder = StateGraph(MultiAgentState)

    # Nodo supervisor
    builder.add_node("supervisor", supervisor_node)

    # Sub-agente Trazabilidad
    builder.add_node("trazabilidad_agent", traz_agent)
    builder.add_node("trazabilidad_tools", traz_tools)

    # Sub-agente Formularios
    builder.add_node("formularios_agent", form_agent)
    builder.add_node("formularios_tools", form_tools)
    builder.add_node("formularios_ask_human", form_ask)

    # Sub-agente Análisis
    builder.add_node("analisis_agent", anal_agent)
    builder.add_node("analisis_tools", anal_tools)

    # Agente directo
    builder.add_node("direct_agent", direct_agent_node)

    # Entry point
    builder.set_entry_point("supervisor")

    # Edges: Trazabilidad
    builder.add_conditional_edges(
        "trazabilidad_agent", traz_router,
        {"trazabilidad_tools": "trazabilidad_tools", END: END},
    )
    builder.add_edge("trazabilidad_tools", "trazabilidad_agent")

    # Edges: Formularios
    builder.add_conditional_edges(
        "formularios_agent", form_router,
        {
            "formularios_tools": "formularios_tools",
            "formularios_ask_human": "formularios_ask_human",
            END: END,
        },
    )
    builder.add_edge("formularios_tools", "formularios_agent")
    builder.add_edge("formularios_ask_human", "formularios_agent")

    # Edges: Análisis
    builder.add_conditional_edges(
        "analisis_agent", anal_router,
        {"analisis_tools": "analisis_tools", END: END},
    )
    builder.add_edge("analisis_tools", "analisis_agent")

    # Edges: Directo
    builder.add_edge("direct_agent", END)

    _multi_graph = builder.compile(checkpointer=get_checkpointer())
    log.info("multi_agent: grafo compilado (trazabilidad=%d tools, formularios=%d tools, analisis=%d tools)",
             len(TOOLS_TRAZABILIDAD), len(TOOLS_FORMULARIOS), len(TOOLS_ANALISIS))
    return _multi_graph


# =============================================================================
# Punto de entrada público
# =============================================================================

def _extract_final_response(messages: list[BaseMessage]) -> str:
    for msg in reversed(messages):
        if isinstance(msg, AIMessage) and msg.content and not getattr(msg, "tool_calls", None):
            return str(msg.content)
    return ""


def _extract_interrupt_question(state) -> str:
    for task in state.tasks:
        for intr in getattr(task, "interrupts", []):
            if intr.value:
                return str(intr.value)
    return "Necesito más información para continuar."


async def run_multi_agent(
    chat_id: int | str,
    user_message: str,
    operator_name: str = "Operador",
    is_resume: bool = False,
    resume_value: str | None = None,
) -> dict[str, Any]:
    """Punto de entrada principal del multi-agente.

    Misma interfaz que `run_agent_for_telegram` para fácil intercambio.

    Returns:
        dict con: response (str), interrupted (bool), question (str), active_agent (str)
    """
    graph = get_multi_graph()
    config = {"configurable": {"thread_id": f"multi_{chat_id}"}}

    try:
        if is_resume:
            safe_resume = "" if resume_value is None else str(resume_value)
            result = await graph.ainvoke(Command(resume=safe_resume), config=config)
        else:
            safe_name = re.sub(r"[^\w]", "_", operator_name or "Operador")[:64]
            safe_msg = (user_message or "").strip() or "(mensaje vacío)"
            result = await graph.ainvoke(
                {
                    "messages": [HumanMessage(content=safe_msg, name=safe_name)],
                    "active_agent": "supervisor",
                    "handoff_count": 0,
                },
                config=config,
            )

        state = await graph.aget_state(config)
        active = result.get("active_agent", "supervisor") if isinstance(result, dict) else "supervisor"

        if state.next:
            return {
                "response": "",
                "interrupted": True,
                "question": _extract_interrupt_question(state),
                "active_agent": active,
            }

        messages = result.get("messages", []) if isinstance(result, dict) else []
        return {
            "response": _extract_final_response(messages),
            "interrupted": False,
            "question": "",
            "active_agent": active,
        }

    except Exception as exc:
        log.error("multi_agent: error en chat_id=%s: %s", chat_id, exc, exc_info=True)
        return {
            "response": "Lo siento, ocurrió un error. Por favor inténtalo de nuevo.",
            "interrupted": False,
            "question": "",
            "active_agent": "error",
        }


# =============================================================================
# Integración con telegram_bot.py
# =============================================================================

def is_multi_agent_enabled() -> bool:
    """Devuelve True si MULTI_AGENT=true está en el entorno."""
    return os.getenv("MULTI_AGENT", "false").strip().lower() in ("true", "1", "yes")


async def run_agent_auto(
    chat_id: int,
    user_message: str,
    operator_name: str = "Operador",
    is_resume: bool = False,
    resume_value: str | None = None,
) -> dict[str, Any]:
    """Usa multi-agente si MULTI_AGENT=true, de lo contrario usa el agente único.

    Reemplaza la llamada a `run_agent_for_telegram` en telegram_bot.py:

        from multi_agent import run_agent_auto
        result = await run_agent_auto(chat_id, message, operator_name)
    """
    if is_multi_agent_enabled():
        log.debug("multi_agent: modo multi activado (chat_id=%s)", chat_id)
        return await run_multi_agent(
            chat_id=chat_id,
            user_message=user_message,
            operator_name=operator_name,
            is_resume=is_resume,
            resume_value=resume_value,
        )

    from agent import run_agent_for_telegram
    return await run_agent_for_telegram(
        chat_id=chat_id,
        user_message=user_message,
        operator_name=operator_name,
        is_resume=is_resume,
        resume_value=resume_value,
    )
