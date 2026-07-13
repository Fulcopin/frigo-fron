"""
eval_agent.py - Framework de Evaluación GenAI para FrigoIA

Implementa evaluación sistemática del agente con tres capas:
  1. LLM-as-Judge  — GPT-4o evalúa la respuesta del agente (task_completion,
                     no_hallucination, language_compliance).
  2. Tool Precision — verifica que el agente llamó las herramientas correctas.
  3. Regression     — compara con respuestas de referencia del dominio Frigolab.

Resultados:
  - Se guardan en eval_results_<timestamp>.json (siempre).
  - Se suben a LangSmith como "dataset run" si LANGSMITH_API_KEY está configurado.

Uso:
    python eval_agent.py                         # evalúa todos los casos
    python eval_agent.py --suite trazabilidad    # solo la suite indicada
    python eval_agent.py --dry-run               # sin llamadas reales al LLM
    python eval_agent.py --case trace_001        # evalúa un caso específico
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Any

from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger(__name__)
logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)


# =============================================================================
# Dataset de evaluación — casos representativos del dominio Frigolab
# =============================================================================

@dataclass
class EvalCase:
    """Un caso de prueba del agente."""
    id: str
    input: str
    expected_tools: list[str]         # tools que deben ser llamadas
    expected_keywords: list[str]      # palabras clave esperadas en la respuesta
    forbidden_phrases: list[str]      # indicadores de alucinación o error
    category: str                     # trazabilidad | formularios | analisis | edge
    description: str = ""
    reference_answer: str = ""        # respuesta de referencia (opcional)


EVAL_DATASET: list[EvalCase] = [
    # ─── Trazabilidad ───────────────────────────────────────────────────────
    EvalCase(
        id="trace_001",
        input="quiero rastrear el lote ABC-2024-001",
        expected_tools=["rastrear_lote_tool"],
        expected_keywords=["lote", "ABC-2024-001"],
        forbidden_phrases=["inventé", "no tengo acceso", "no puedo acceder"],
        category="trazabilidad",
        description="Rastreo básico de lote por número exacto",
    ),
    EvalCase(
        id="trace_002",
        input="que etapas le faltan al lote XYZ-0042 para estar completo",
        expected_tools=["analizar_brecha_lote_tool"],
        expected_keywords=["lote", "etapa", "XYZ-0042"],
        forbidden_phrases=["asumo", "probablemente", "creo que"],
        category="trazabilidad",
        description="Análisis de brecha — etapas faltantes de un lote",
    ),
    EvalCase(
        id="trace_003",
        input="dame la lista de lotes de esta semana",
        expected_tools=["listar_lotes_tool"],
        expected_keywords=["lote"],
        forbidden_phrases=["no tengo información", "inventé"],
        category="trazabilidad",
        description="Listado de lotes recientes",
    ),
    EvalCase(
        id="trace_004",
        input="el lote 9999 está completo?",
        expected_tools=["analizar_brecha_lote_tool"],
        expected_keywords=["lote", "9999"],
        forbidden_phrases=["asumo que sí", "debería estar"],
        category="trazabilidad",
        description="Verificación de completitud de lote",
    ),
    # ─── Formularios ────────────────────────────────────────────────────────
    EvalCase(
        id="form_001",
        input="quiero llenar el formulario de fileteo FOR-PD-04",
        expected_tools=["obtener_esquema_formulario_tool"],
        expected_keywords=["formulario", "FOR-PD-04", "campo"],
        forbidden_phrases=["no existe ese formulario", "asumo los campos"],
        category="formularios",
        description="Solicitud de esquema de formulario antes de dictado",
    ),
    EvalCase(
        id="form_002",
        input="guardar borrador del formulario de control de sellos con lote 2024-10",
        expected_tools=["guardar_borrador_tool"],
        expected_keywords=["borrador", "guardado"],
        forbidden_phrases=["no pude guardar porque no tengo acceso"],
        category="formularios",
        description="Guardado de borrador de formulario",
    ),
    EvalCase(
        id="form_003",
        input="necesito el esquema del formulario de liberacion de tunel",
        expected_tools=["obtener_esquema_formulario_tool"],
        expected_keywords=["formulario", "campo"],
        forbidden_phrases=["inventé los campos"],
        category="formularios",
        description="Esquema de formulario por nombre parcial",
    ),
    # ─── Análisis / Estadísticas ─────────────────────────────────────────────
    EvalCase(
        id="analisis_001",
        input="dame el resumen del día, como vamos en producción",
        expected_tools=["resumen_negocio_tool"],
        expected_keywords=["lote", "formulario", "cumplimiento"],
        forbidden_phrases=["no tengo datos de hoy", "inventé"],
        category="analisis",
        description="Dashboard diario de producción",
    ),
    EvalCase(
        id="analisis_002",
        input="cuál es el porcentaje de cumplimiento de formularios esta semana",
        expected_tools=["estadisticas_formularios_tool"],
        expected_keywords=["%", "formulario"],
        forbidden_phrases=["no puedo calcular", "asumo"],
        category="analisis",
        description="Estadísticas de cumplimiento de formularios",
    ),
    EvalCase(
        id="analisis_003",
        input="analiza las temperaturas del formulario FOR-CC-10 del último mes",
        expected_tools=["analizar_datos_formulario_tool"],
        expected_keywords=["temperatura", "FOR-CC-10"],
        forbidden_phrases=["no tengo acceso a temperaturas", "inventé"],
        category="analisis",
        description="Análisis de datos dentro de un tipo de formulario",
    ),
    # ─── Edge cases ─────────────────────────────────────────────────────────
    EvalCase(
        id="edge_001",
        input="hola",
        expected_tools=[],
        expected_keywords=["hola", "ayudar", "frigolab"],
        forbidden_phrases=["error", "no entiendo"],
        category="edge",
        description="Saludo simple — no debe llamar tools",
    ),
    EvalCase(
        id="edge_002",
        input="cuál es la capital de Francia",
        expected_tools=[],
        expected_keywords=["Frigolab", "producción", "formulario"],
        forbidden_phrases=["París", "capital", "Francia"],
        category="edge",
        description="Pregunta fuera de dominio — debe rechazar gentilmente",
    ),
    EvalCase(
        id="edge_003",
        input="hay alertas de temperatura crítica ahora mismo",
        expected_tools=["resumen_negocio_tool"],
        expected_keywords=["temperatura", "alerta"],
        forbidden_phrases=["no monitoreo temperaturas", "inventé"],
        category="edge",
        description="Alerta de temperatura — debe consultar datos reales",
    ),
]


# =============================================================================
# Runner: ejecuta el agente sobre un caso
# =============================================================================

async def _run_case_live(case: EvalCase) -> dict[str, Any]:
    """Ejecuta el agente real (modo live). Requiere BD y LLM configurados."""
    from agent import run_agent
    start = time.perf_counter()
    try:
        result = await run_agent(case.input, conversation_history=None)
        elapsed_ms = (time.perf_counter() - start) * 1000
        return {
            "response": result.get("response", ""),
            "tools_used": result.get("tools_used", []),
            "tool_results": result.get("tool_results", []),
            "elapsed_ms": round(elapsed_ms, 1),
            "error": None,
        }
    except Exception as exc:
        return {
            "response": "",
            "tools_used": [],
            "tool_results": [],
            "elapsed_ms": round((time.perf_counter() - start) * 1000, 1),
            "error": str(exc),
        }


def _run_case_dry(case: EvalCase) -> dict[str, Any]:
    """Modo dry-run: simula una respuesta sin llamar al agente real."""
    mock_response = (
        f"[DRY-RUN] Procesando: {case.input[:60]}... "
        f"(herramientas esperadas: {', '.join(case.expected_tools) or 'ninguna'})"
    )
    return {
        "response": mock_response,
        "tools_used": case.expected_tools,  # simulamos que llamó las correctas
        "tool_results": ["[mock]"],
        "elapsed_ms": 0.0,
        "error": None,
    }


# =============================================================================
# Evaluadores
# =============================================================================

@dataclass
class EvalScore:
    name: str
    score: float          # 0.0 – 1.0
    passed: bool
    reasoning: str = ""


def eval_tool_precision(case: EvalCase, run: dict[str, Any]) -> EvalScore:
    """Evalúa si el agente llamó las tools correctas (sin extras ni faltantes).

    Métrica: F1 entre expected_tools y tools_used.
    Si expected_tools está vacío, pasa si tools_used también está vacío.
    """
    expected = set(case.expected_tools)
    used = set(run["tools_used"])

    if not expected:
        passed = len(used) == 0
        score = 1.0 if passed else 0.0
        return EvalScore(
            name="tool_precision",
            score=score,
            passed=passed,
            reasoning=(
                "Sin tools esperadas y ninguna usada — correcto."
                if passed
                else f"Se esperaba que no llamara tools pero llamó: {used}"
            ),
        )

    tp = len(expected & used)
    fp = len(used - expected)
    fn = len(expected - used)

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

    return EvalScore(
        name="tool_precision",
        score=round(f1, 3),
        passed=f1 >= 0.8,
        reasoning=(
            f"F1={f1:.2f} | esperadas={expected} | usadas={used} | "
            f"TP={tp}, FP={fp}, FN={fn}"
        ),
    )


def eval_language_compliance(case: EvalCase, run: dict[str, Any]) -> EvalScore:
    """Verifica que la respuesta esté en español (mínimo heurístico)."""
    response = run["response"].lower()
    if not response or run["error"]:
        return EvalScore(
            name="language_compliance",
            score=0.0,
            passed=False,
            reasoning="Sin respuesta o error en ejecución.",
        )

    # Palabras comunes del español que no aparecen en inglés puro
    spanish_markers = ["el ", "la ", "los ", "las ", "de ", "en ", "que ", "y ", "no ", "se "]
    spanish_count = sum(1 for w in spanish_markers if w in response)
    score = min(1.0, spanish_count / 4)
    passed = spanish_count >= 3

    return EvalScore(
        name="language_compliance",
        score=round(score, 3),
        passed=passed,
        reasoning=f"Marcadores de español encontrados: {spanish_count}/10",
    )


def eval_no_hallucination(case: EvalCase, run: dict[str, Any]) -> EvalScore:
    """Detecta frases que indican que el agente inventó datos o no usó tools."""
    response = run["response"].lower()
    if not response or run["error"]:
        return EvalScore(
            name="no_hallucination",
            score=0.0,
            passed=False,
            reasoning="Sin respuesta o error en ejecución.",
        )

    found = [phrase for phrase in case.forbidden_phrases if phrase.lower() in response]
    passed = len(found) == 0
    score = 0.0 if found else 1.0

    return EvalScore(
        name="no_hallucination",
        score=score,
        passed=passed,
        reasoning=(
            f"Frases prohibidas detectadas: {found}" if found
            else "Ninguna frase de alucinación detectada."
        ),
    )


async def eval_task_completion_llm(
    case: EvalCase,
    run: dict[str, Any],
    judge_llm,
) -> EvalScore:
    """Evalúa con un LLM-as-Judge si la tarea fue completada correctamente.

    Usa GPT-4o como juez neutral. El prompt sigue el patrón estándar de
    evaluación con criterios explícitos y puntuación 1-5.
    """
    from langchain_core.messages import HumanMessage, SystemMessage

    if run["error"] or not run["response"]:
        return EvalScore(
            name="task_completion",
            score=0.0,
            passed=False,
            reasoning=f"Agente falló con error: {run.get('error', 'sin respuesta')}",
        )

    judge_system = """Eres un evaluador experto de sistemas de IA para plantas de producción industrial.
Tu tarea es evaluar si un agente de IA completó correctamente la solicitud de un operario.

Responde ÚNICAMENTE con un JSON con este formato exacto:
{
  "score": <número del 1 al 5>,
  "reasoning": "<explicación breve en español>"
}

Criterios de puntuación:
5 — Respuesta completa, precisa y útil. El agente usó las herramientas correctas y proveyó información relevante.
4 — Respuesta buena con detalles menores faltantes.
3 — Respuesta parcial o con alguna imprecisión no crítica.
2 — Respuesta pobre, falta información importante o hay errores.
1 — Respuesta incorrecta, fuera de tema, o el agente alucinó datos."""

    judge_human = f"""SOLICITUD DEL OPERARIO:
{case.input}

RESPUESTA DEL AGENTE:
{run["response"][:1000]}

HERRAMIENTAS USADAS:
{", ".join(run["tools_used"]) or "ninguna"}

HERRAMIENTAS ESPERADAS:
{", ".join(case.expected_tools) or "ninguna"}

Evalúa si la respuesta del agente completó correctamente la solicitud."""

    try:
        result = await judge_llm.ainvoke([
            SystemMessage(content=judge_system),
            HumanMessage(content=judge_human),
        ])
        parsed = json.loads(result.content.strip())
        raw_score = int(parsed.get("score", 1))
        normalized = (raw_score - 1) / 4  # 1-5 → 0.0-1.0
        return EvalScore(
            name="task_completion",
            score=round(normalized, 3),
            passed=raw_score >= 4,
            reasoning=parsed.get("reasoning", ""),
        )
    except Exception as exc:
        log.warning("LLM judge falló para caso %s: %s", case.id, exc)
        return EvalScore(
            name="task_completion",
            score=0.5,
            passed=False,
            reasoning=f"Error al invocar LLM judge: {exc}",
        )


def eval_keyword_coverage(case: EvalCase, run: dict[str, Any]) -> EvalScore:
    """Verifica que la respuesta mencione las palabras clave esperadas."""
    response = run["response"].lower()
    if not response or run["error"]:
        return EvalScore(
            name="keyword_coverage",
            score=0.0,
            passed=False,
            reasoning="Sin respuesta o error.",
        )

    if not case.expected_keywords:
        return EvalScore(
            name="keyword_coverage",
            score=1.0,
            passed=True,
            reasoning="Sin keywords requeridas.",
        )

    found = [kw for kw in case.expected_keywords if kw.lower() in response]
    score = len(found) / len(case.expected_keywords)
    return EvalScore(
        name="keyword_coverage",
        score=round(score, 3),
        passed=score >= 0.7,
        reasoning=f"Encontradas: {found} / Requeridas: {case.expected_keywords}",
    )


# =============================================================================
# Resultado de evaluación
# =============================================================================

@dataclass
class CaseResult:
    case_id: str
    category: str
    description: str
    input: str
    response: str
    tools_used: list[str]
    elapsed_ms: float
    scores: list[EvalScore]
    overall_passed: bool = False
    overall_score: float = 0.0
    error: str | None = None

    def compute_overall(self) -> None:
        if self.scores:
            self.overall_score = round(sum(s.score for s in self.scores) / len(self.scores), 3)
            self.overall_passed = all(s.passed for s in self.scores)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["scores"] = [asdict(s) for s in self.scores]
        return d


# =============================================================================
# Runner principal
# =============================================================================

async def evaluate_case(
    case: EvalCase,
    judge_llm,
    dry_run: bool = False,
) -> CaseResult:
    """Ejecuta un caso completo: run → evalúa → devuelve CaseResult."""
    log.info("Evaluando caso %s: %s", case.id, case.description)

    if dry_run:
        run = _run_case_dry(case)
    else:
        run = await _run_case_live(case)

    scores = [
        eval_tool_precision(case, run),
        eval_language_compliance(case, run),
        eval_no_hallucination(case, run),
        eval_keyword_coverage(case, run),
    ]

    # LLM-as-judge (más costoso, siempre al final)
    if not dry_run and judge_llm is not None:
        llm_score = await eval_task_completion_llm(case, run, judge_llm)
        scores.append(llm_score)

    result = CaseResult(
        case_id=case.id,
        category=case.category,
        description=case.description,
        input=case.input,
        response=run["response"],
        tools_used=run["tools_used"],
        elapsed_ms=run["elapsed_ms"],
        scores=scores,
        error=run["error"],
    )
    result.compute_overall()
    return result


async def run_evaluation(
    suite: str | None = None,
    case_id: str | None = None,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Ejecuta la evaluación completa y devuelve el reporte."""
    from agent import _build_llm
    from observability import configure_langsmith

    configure_langsmith()

    # Filtrar dataset
    cases = EVAL_DATASET
    if suite:
        cases = [c for c in cases if c.category == suite]
    if case_id:
        cases = [c for c in cases if c.id == case_id]

    if not cases:
        log.warning("No se encontraron casos para suite=%s case_id=%s", suite, case_id)
        return {"results": [], "summary": {}}

    log.info("Iniciando evaluación: %d casos (dry_run=%s)", len(cases), dry_run)

    # Judge LLM (temperatura 0 para reproducibilidad)
    judge_llm = None
    if not dry_run:
        try:
            judge_llm = _build_llm(temperature=0.0)
            log.info("LLM judge inicializado.")
        except Exception as exc:
            log.warning("No se pudo inicializar el LLM judge: %s", exc)

    # Ejecutar todos los casos
    results: list[CaseResult] = []
    for case in cases:
        try:
            result = await evaluate_case(case, judge_llm, dry_run=dry_run)
            results.append(result)
            status = "PASS" if result.overall_passed else "FAIL"
            log.info(
                "[%s] %s — score=%.2f elapsed=%.0fms",
                status, result.case_id, result.overall_score, result.elapsed_ms,
            )
        except Exception as exc:
            log.error("Error evaluando caso %s: %s", case.id, exc, exc_info=True)

    # Resumen global
    summary = _compute_summary(results)
    _log_summary(summary)

    # Exportar a JSON
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"eval_results_{timestamp}.json"
    report = {
        "timestamp": timestamp,
        "dry_run": dry_run,
        "suite_filter": suite,
        "case_filter": case_id,
        "total_cases": len(results),
        "summary": summary,
        "results": [r.to_dict() for r in results],
    }
    try:
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        log.info("Resultados guardados en: %s", output_file)
    except Exception as exc:
        log.warning("No se pudo guardar el archivo de resultados: %s", exc)

    # Subir a LangSmith si está configurado
    _upload_to_langsmith(report, results)

    return report


def _compute_summary(results: list[CaseResult]) -> dict:
    """Calcula métricas agregadas por categoría y global."""
    if not results:
        return {}

    total = len(results)
    passed = sum(1 for r in results if r.overall_passed)

    # Por categoría
    by_category: dict[str, dict] = {}
    for r in results:
        cat = r.category
        if cat not in by_category:
            by_category[cat] = {"total": 0, "passed": 0, "scores": []}
        by_category[cat]["total"] += 1
        by_category[cat]["passed"] += int(r.overall_passed)
        by_category[cat]["scores"].append(r.overall_score)

    category_summary = {}
    for cat, data in by_category.items():
        category_summary[cat] = {
            "pass_rate": round(data["passed"] / data["total"], 3),
            "avg_score": round(sum(data["scores"]) / len(data["scores"]), 3),
            "total": data["total"],
        }

    # Por evaluador
    evaluator_scores: dict[str, list[float]] = {}
    for r in results:
        for s in r.scores:
            evaluator_scores.setdefault(s.name, []).append(s.score)

    evaluator_summary = {
        name: round(sum(scores) / len(scores), 3)
        for name, scores in evaluator_scores.items()
    }

    avg_elapsed = sum(r.elapsed_ms for r in results) / total

    return {
        "pass_rate": round(passed / total, 3),
        "avg_score": round(sum(r.overall_score for r in results) / total, 3),
        "total_passed": passed,
        "total_cases": total,
        "avg_elapsed_ms": round(avg_elapsed, 1),
        "by_category": category_summary,
        "by_evaluator": evaluator_summary,
    }


def _log_summary(summary: dict) -> None:
    """Imprime el resumen de evaluación en consola."""
    if not summary:
        return
    print("\n" + "=" * 60)
    print("  EVALUACIÓN FRIGOAI — RESUMEN")
    print("=" * 60)
    print(f"  Pass rate global : {summary['pass_rate']:.1%} ({summary['total_passed']}/{summary['total_cases']})")
    print(f"  Score promedio   : {summary['avg_score']:.3f}")
    print(f"  Latencia promedio: {summary['avg_elapsed_ms']:.0f} ms")
    print()
    print("  Por categoría:")
    for cat, data in summary.get("by_category", {}).items():
        print(f"    {cat:<20} pass={data['pass_rate']:.1%}  score={data['avg_score']:.3f}")
    print()
    print("  Por evaluador:")
    for ev, score in summary.get("by_evaluator", {}).items():
        print(f"    {ev:<25} avg_score={score:.3f}")
    print("=" * 60 + "\n")


def _upload_to_langsmith(report: dict, results: list[CaseResult]) -> None:
    """Sube los resultados como dataset + experimento a LangSmith."""
    api_key = os.getenv("LANGSMITH_API_KEY", "").strip()
    if not api_key:
        log.info("LANGSMITH_API_KEY no configurado — omitiendo upload a LangSmith.")
        return
    try:
        from langsmith import Client
        client = Client(api_key=api_key)

        dataset_name = "FrigoIA-EvalSuite"
        # Crear dataset si no existe
        try:
            dataset = client.read_dataset(dataset_name=dataset_name)
        except Exception:
            dataset = client.create_dataset(
                dataset_name=dataset_name,
                description="Dataset de evaluación del agente FrigoIA (trazabilidad, formularios, análisis)",
            )

        # Subir ejemplos y feedback
        for r in results:
            try:
                client.create_example(
                    inputs={"input": r.input},
                    outputs={"response": r.response, "tools_used": r.tools_used},
                    dataset_id=dataset.id,
                    metadata={
                        "case_id": r.case_id,
                        "category": r.category,
                        "overall_score": r.overall_score,
                        "overall_passed": r.overall_passed,
                        "eval_timestamp": report["timestamp"],
                    },
                )
            except Exception as exc:
                log.debug("No se pudo subir ejemplo %s a LangSmith: %s", r.case_id, exc)

        log.info("Resultados subidos a LangSmith dataset '%s'", dataset_name)
    except ImportError:
        log.warning("langsmith SDK no instalado. Ejecuta: pip install langsmith")
    except Exception as exc:
        log.warning("Error subiendo a LangSmith: %s", exc)


# =============================================================================
# CLI
# =============================================================================

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluación GenAI del agente FrigoIA",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  python eval_agent.py                         # evalúa todos los casos
  python eval_agent.py --suite trazabilidad    # solo trazabilidad
  python eval_agent.py --case trace_001        # un caso específico
  python eval_agent.py --dry-run               # sin llamadas reales al LLM
  python eval_agent.py --list                  # muestra los casos disponibles
        """,
    )
    parser.add_argument(
        "--suite",
        choices=["trazabilidad", "formularios", "analisis", "edge"],
        help="Filtrar por categoría",
    )
    parser.add_argument("--case", help="ID de un caso específico")
    parser.add_argument("--dry-run", action="store_true", help="Simular sin llamadas reales")
    parser.add_argument(
        "--list",
        action="store_true",
        help="Listar los casos disponibles y salir",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()

    if args.list:
        print(f"\n{'ID':<15} {'Categoría':<15} {'Descripción'}")
        print("-" * 65)
        for c in EVAL_DATASET:
            print(f"{c.id:<15} {c.category:<15} {c.description}")
        print(f"\nTotal: {len(EVAL_DATASET)} casos\n")
    else:
        asyncio.run(
            run_evaluation(
                suite=args.suite,
                case_id=args.case,
                dry_run=args.dry_run,
            )
        )
