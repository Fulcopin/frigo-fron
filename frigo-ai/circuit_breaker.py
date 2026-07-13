"""
circuit_breaker.py - Filtro de ruido industrial + Circuit Breaker para Whisper

Problema: En una planta de pescado, Whisper recibirá ruido de motores de
refrigeración, compresores, sierras de corte. Enviar ese ruido a Claude/GPT-4o
gasta tokens, genera respuestas sin sentido y congela al agente.

Solución: Un filtro rápido POST-Whisper que evalúa la transcripción
ANTES de enviarla al LLM. Si detecta ruido, aborta el flujo en <100ms
y devuelve una respuesta pregrabada.

Flujo:
  Audio → Whisper → CircuitBreaker.evaluate() → { PASS | REJECT }
       PASS   → LangGraph Agent (gasta tokens)
       REJECT → Respuesta pregrabada instantánea (0 tokens, 0 latencia)
"""
from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass, field
from enum import Enum

log = logging.getLogger(__name__)


class TranscriptionVerdict(Enum):
    """Resultado de la evaluación del circuit breaker."""
    PASS = "pass"                    # Transcripción válida → enviar al agente
    REJECT_EMPTY = "reject_empty"    # Whisper no devolvió nada
    REJECT_TOO_SHORT = "reject_short"  # Menos de 3 palabras significativas
    REJECT_NOISE = "reject_noise"    # Patrón de ruido detectado
    REJECT_REPETITION = "reject_repetition"  # Repetición sin sentido (alucinación de Whisper)


# Respuestas pregrabadas por tipo de rechazo (instantáneas, 0 tokens)
CACHED_RESPONSES: dict[TranscriptionVerdict, str] = {
    TranscriptionVerdict.REJECT_EMPTY: (
        "No te copié, parece que el micrófono no captó tu voz. "
        "Acércate al micrófono y repite por favor."
    ),
    TranscriptionVerdict.REJECT_TOO_SHORT: (
        "No te copié bien, hay mucho ruido. "
        "Repite tu mensaje más despacio, por favor."
    ),
    TranscriptionVerdict.REJECT_NOISE: (
        "Detecté solo ruido de fondo, no pude distinguir tu voz. "
        "Aléjate de la maquinaria y vuelve a intentarlo."
    ),
    TranscriptionVerdict.REJECT_REPETITION: (
        "Parece que hubo interferencia en el audio. "
        "Repite tu mensaje por favor."
    ),
}


# Patrones que Whisper genera cuando recibe ruido puro
_NOISE_PATTERNS: list[re.Pattern] = [
    re.compile(r'^\.+$'),                              # Solo puntos "....."
    re.compile(r'^[,.\s]+$'),                          # Solo puntuación
    re.compile(r'(?i)^(eh|ah|oh|um|uh|mm|hmm)[\s.]*$'),  # Solo muletillas
    re.compile(r'(?i)^gracias por ver'),               # Alucinación común de Whisper
    re.compile(r'(?i)^suscr[ií]bete'),                 # Alucinación de YouTube
    re.compile(r'(?i)^thank'),                         # Whisper cambia a inglés con ruido
    re.compile(r'(?i)^music$'),                        # Tag de música
    re.compile(r'(?i)^\[.*\]$'),                       # Tags como [Música], [Aplausos]
    re.compile(r'(?i)^subtítulos'),                    # Alucinación de subtítulos
    re.compile(r'(?i)^you$'),                          # Alucinación corta en inglés
]

# Palabras vacías que no cuentan como contenido real
_STOP_WORDS: set[str] = {
    "el", "la", "los", "las", "de", "del", "en", "un", "una", "y", "o",
    "a", "es", "que", "por", "con", "para", "se", "no", "lo", "le",
    "me", "te", "su", "al", "mi", "si", "ya", "ha", "he", "eh", "ah",
    "oh", "um", "uh", "mm", "hmm", "este", "esto", "eso", "esa",
}


@dataclass
class CircuitBreaker:
    """Filtro post-Whisper para detectar ruido industrial y alucinaciones.

    Evalúa la transcripción en microsegundos. Si la rechaza, el flujo
    se detiene ANTES de llamar al LLM, ahorrando tokens y latencia.

    Attributes:
        min_meaningful_words: Mínimo de palabras significativas para aceptar.
        max_repetition_ratio: Si >70% del texto es una palabra repetida → ruido.
        consecutive_rejects: Contador de rechazos consecutivos.
        max_consecutive_rejects: Si se superan, sugerir ayuda técnica.
    """
    min_meaningful_words: int = 3
    max_repetition_ratio: float = 0.7
    consecutive_rejects: int = field(default=0, init=False)
    max_consecutive_rejects: int = 5

    def evaluate(self, transcription: str | None) -> tuple[TranscriptionVerdict, str]:
        """Evalúa una transcripción de Whisper.

        Args:
            transcription: Texto devuelto por Whisper (puede ser None o vacío).

        Returns:
            Tuple de (veredicto, mensaje_para_operario).
            Si veredicto es PASS, el mensaje está vacío y se debe enviar al LLM.
        """
        start = time.perf_counter_ns()

        # Check 1: vacío
        if not transcription or not transcription.strip():
            self._record_reject()
            elapsed_us = (time.perf_counter_ns() - start) / 1000
            log.info("CircuitBreaker: REJECT_EMPTY en %.0fμs", elapsed_us)
            return TranscriptionVerdict.REJECT_EMPTY, self._get_response(
                TranscriptionVerdict.REJECT_EMPTY
            )

        text = transcription.strip()

        # Check 2: patrones de ruido conocidos
        for pattern in _NOISE_PATTERNS:
            if pattern.match(text):
                self._record_reject()
                elapsed_us = (time.perf_counter_ns() - start) / 1000
                log.info(
                    "CircuitBreaker: REJECT_NOISE '%s' en %.0fμs",
                    text[:40], elapsed_us,
                )
                return TranscriptionVerdict.REJECT_NOISE, self._get_response(
                    TranscriptionVerdict.REJECT_NOISE
                )

        # Check 3: muy pocas palabras significativas
        words = text.lower().split()
        meaningful = [w for w in words if w.strip(".,;:!?") not in _STOP_WORDS and len(w) > 1]

        if len(meaningful) < self.min_meaningful_words:
            self._record_reject()
            elapsed_us = (time.perf_counter_ns() - start) / 1000
            log.info(
                "CircuitBreaker: REJECT_SHORT (%d palabras sig.) '%s' en %.0fμs",
                len(meaningful), text[:40], elapsed_us,
            )
            return TranscriptionVerdict.REJECT_TOO_SHORT, self._get_response(
                TranscriptionVerdict.REJECT_TOO_SHORT
            )

        # Check 4: repetición excesiva (alucinación de Whisper)
        if len(words) >= 4:
            word_counts = {}
            for w in words:
                clean = w.strip(".,;:!?").lower()
                word_counts[clean] = word_counts.get(clean, 0) + 1

            max_count = max(word_counts.values())
            if max_count / len(words) > self.max_repetition_ratio:
                self._record_reject()
                elapsed_us = (time.perf_counter_ns() - start) / 1000
                log.info(
                    "CircuitBreaker: REJECT_REPETITION '%s' en %.0fμs",
                    text[:40], elapsed_us,
                )
                return TranscriptionVerdict.REJECT_REPETITION, self._get_response(
                    TranscriptionVerdict.REJECT_REPETITION
                )

        # Pasa todos los checks → enviar al agente
        self.consecutive_rejects = 0
        elapsed_us = (time.perf_counter_ns() - start) / 1000
        log.debug("CircuitBreaker: PASS '%s' en %.0fμs", text[:40], elapsed_us)
        return TranscriptionVerdict.PASS, ""

    def _record_reject(self) -> None:
        """Incrementa el contador de rechazos consecutivos."""
        self.consecutive_rejects += 1
        if self.consecutive_rejects >= self.max_consecutive_rejects:
            log.warning(
                "CircuitBreaker: %d rechazos consecutivos. "
                "Posible problema de hardware (micrófono) o entorno extremo.",
                self.consecutive_rejects,
            )

    def _get_response(self, verdict: TranscriptionVerdict) -> str:
        """Obtiene la respuesta pregrabada, con hint adicional si hay muchos rechazos."""
        base = CACHED_RESPONSES.get(verdict, "No te copié. Repite por favor.")
        if self.consecutive_rejects >= self.max_consecutive_rejects:
            return (
                f"{base}\n\n"
                "Nota: He tenido varios intentos fallidos seguidos. "
                "Verifica que tu micrófono funcione correctamente o "
                "intenta enviar un mensaje de texto."
            )
        return base


# Instancia global del circuit breaker (thread-safe: solo lectura + un int)
whisper_circuit_breaker = CircuitBreaker()
