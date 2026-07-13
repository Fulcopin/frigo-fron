# FrigoVoice AI — Arquitectura Completa y Trazabilidad del Agente

> Sistema de inteligencia artificial con voz para Frigolab San Mateo.  
> Planta procesadora de productos del mar — Ecuador.

---

## Índice

1. [Visión General del Sistema](#1-visión-general-del-sistema)
2. [Mapa de Módulos](#2-mapa-de-módulos)
3. [Fase 1 — Pipeline ETL (RAG)](#3-fase-1--pipeline-etl-rag)
4. [Fase 2 — Agente con Tool Calling](#4-fase-2--agente-con-tool-calling)
5. [Flujo Completo: Trazabilidad de un Lote](#5-flujo-completo-trazabilidad-de-un-lote)
6. [Flujo Completo: Llenado de Formulario por Voz](#6-flujo-completo-llenado-de-formulario-por-voz)
7. [Estructuras de Datos en Cada Etapa](#7-estructuras-de-datos-en-cada-etapa)
8. [Endpoints de la API (FastAPI)](#8-endpoints-de-la-api-fastapi)
9. [Motor de Decisión del Agente ReAct](#9-motor-de-decisión-del-agente-react)
10. [Análisis de Cada Herramienta (Tool)](#10-análisis-de-cada-herramienta-tool)
11. [Formularios: Estructura y Etapas de Llenado](#11-formularios-estructura-y-etapas-de-llenado)
12. [Esquema de Base de Datos Implícito](#12-esquema-de-base-de-datos-implícito)
13. [Diagrama de Secuencia — Consulta por Voz (Agente)](#13-diagrama-de-secuencia--consulta-por-voz-agente)
14. [Problemas Detectados y Mejoras Propuestas](#14-problemas-detectados-y-mejoras-propuestas)

---

## 1. Visión General del Sistema

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRIGOVOICE AI v2.0                              │
│                                                                         │
│  ENTRADA                     CEREBRO                     SALIDA        │
│  ────────                   ──────────                  ────────       │
│  🎤 Audio WebM  ──►  Whisper STT  ──►  Agente LangChain  ──►  Texto   │
│  ⌨️  Texto      ──►  (directo)    ──►  (Mistral + Tools)  ──►  Voz    │
│                                         │                               │
│                              ┌──────────┴───────────┐                  │
│                              │    3 HERRAMIENTAS     │                  │
│                              │  ① buscar_trazabilidad│                  │
│                              │  ② crear_borrador     │                  │
│                              │  ③ listar_formularios  │                  │
│                              └──────────┬───────────┘                  │
│                                         │                               │
│                         ┌───────────────┴───────────────┐              │
│                         │         SQL Server             │              │
│                         │  FilledForms / Templates /     │              │
│                         │  FormDrafts                    │              │
│                         └───────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────────────┘
```

El sistema tiene **dos fases** independientes pero complementarias:

| Fase | Nombre | Cuándo usar | Motor |
|------|--------|-------------|-------|
| **Fase 1** | RAG + ChromaDB | Consultas semánticas generales | Embeddings + LLM |
| **Fase 2** | Agente + Tool Calling | Queries precisas por lote; llenado de formularios | ReAct + SQL directo |

---

## 2. Mapa de Módulos

```
frigo-ai/
│
├── config.py          ← Variables de entorno y constantes globales
├── server.py          ← FastAPI: todos los endpoints HTTP (Fase 1 + Fase 2)
│
├── ── FASE 1: Pipeline ETL ──────────────────────────────────────────────
├── pipeline.py        ← Orquestador del ETL (extrae → narra → ingest)
├── extractor.py       ← Extrae FilledForms de SQL/API, agrupa por lote
├── narrator.py        ← Convierte eventos del lote en narrativa de texto
├── vectorstore.py     ← CRUD de ChromaDB (embeddings + búsqueda semántica)
├── llm_client.py      ← Cliente HTTP para Ollama (genera respuestas RAG)
│
├── ── FASE 2: Agente ────────────────────────────────────────────────────
├── agent.py           ← Agente LangChain ReAct (Tools + Ollama Mistral)
├── sql_tools.py       ← Implementaciones SQL de las 3 herramientas del agente
│
├── ── SHARED ────────────────────────────────────────────────────────────
├── voice.py           ← Transcripción de audio con OpenAI Whisper STT
│
└── requirements.txt   ← Dependencias Python
```

### Dependencias entre módulos

```
server.py
  ├── vectorstore.py ──► config.py
  ├── llm_client.py  ──► config.py
  ├── voice.py       ──► config.py
  ├── agent.py       ──► config.py
  │     └── sql_tools.py ──► config.py
  └── (pipeline endpoints)
        ├── extractor.py ──► config.py
        ├── narrator.py  ──► config.py
        └── vectorstore.py

pipeline.py (standalone CLI)
  ├── extractor.py
  ├── narrator.py
  └── vectorstore.py
```

---

## 3. Fase 1 — Pipeline ETL (RAG)

### Propósito
Precomputar narrativas de todos los lotes y almacenarlas en ChromaDB para búsqueda semántica rápida. Se ejecuta como batch (`python pipeline.py`) o vía endpoint `POST /api/ai/pipeline/run`.

### Las 3 Etapas del Pipeline

```
SQL Server / API REST
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  PASO 1: EXTRACTOR (extractor.py)                   │
│                                                     │
│  Input:  FilledForms (SQL o API)                    │
│  Output: historial_lotes = {                        │
│    "260302": [ evento1, evento2, ... ],             │
│    "260318": [ evento3, evento4, ... ],             │
│  }                                                  │
│                                                     │
│  Lógica interna:                                    │
│  1. Conecta SQL Server (pyodbc) o API (httpx)       │
│  2. Para cada formulario:                           │
│     a. Parsea HeaderData (JSON)                     │
│     b. Parsea BodyData (JSON)                       │
│     c. Busca campos de lote con regex patterns:     │
│        ^lote$, ^lote[\s_]proceso$, ^batch$, etc.    │
│     d. Si encuentra lote → construye evento         │
│     e. Agrupa por número de lote                    │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  PASO 2: NARRATOR (narrator.py)                     │
│                                                     │
│  Input:  historial_lotes                            │
│  Output: narratives = {                             │
│    "260302": "TRAZABILIDAD DEL LOTE 260302\n...",   │
│    "260318": "TRAZABILIDAD DEL LOTE 260318\n...",   │
│  }                                                  │
│                                                     │
│  Por cada lote:                                     │
│  1. Ordena eventos cronológicamente                 │
│  2. Extrae metadata global (especies, productos,    │
│     firmantes, procesos involucrados)               │
│  3. Construye bloque de encabezado                  │
│  4. Por cada evento → genera párrafo:               │
│     - Proceso + código del formulario               │
│     - Fecha + quién lo registró + rol               │
│     - Resumen del header (campos clave)             │
│     - Resumen del body (filas de tablas)            │
│  5. Concatena todo como texto plano                 │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  PASO 3: VECTORSTORE (vectorstore.py)               │
│                                                     │
│  Input:  narratives (dict lote → string texto)      │
│  Output: ChromaDB actualizado                       │
│                                                     │
│  Lógica:                                            │
│  1. Conecta ChromaDB persistente (./chroma_data)    │
│  2. Usa embedding: all-MiniLM-L6-v2                 │
│     (sentence-transformers, cosine similarity)      │
│  3. Por cada lote: upsert(id, document, metadata)   │
│     - id       = "lote_{numero}"                   │
│     - document = narrativa completa                 │
│     - metadata = {lote, tipo, chars}                │
│  4. Procesa en batches de 50 (límite ChromaDB)      │
└─────────────────────────────────────────────────────┘
       │
       ▼
    ChromaDB
  (./chroma_data)
```

### Consulta RAG (Fase 1, en tiempo real)

```
Usuario hace pregunta
       │
       ▼
POST /api/ai/query  (o /api/ai/voice)
       │
       ├─► vectorstore.search_by_lote(query, n=3)
       │         │
       │         └─► ChromaDB.query(embedding(query))
       │               Retorna top-3 narrativas más similares
       │
       ├─► llm_client.generate_response(query, context)
       │         │
       │         └─► POST http://localhost:11434/api/generate
       │               Ollama Mistral genera respuesta final
       │
       └─► Retorna { answer, sources }
```

---

## 4. Fase 2 — Agente con Tool Calling

### Arquitectura del Agente

```
┌──────────────────────────────────────────────────────────────────┐
│                    AGENTE REACT (agent.py)                       │
│                                                                  │
│  LLM: Ollama Mistral (ChatOllama)                                │
│  Framework: LangGraph create_react_agent                         │
│  Temperatura: 0.3 (determinístico)                               │
│                                                                  │
│  System Prompt: FrigoVoice — auditor experto en español          │
│  Contexto inyectado: fecha y hora actual                         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                     CICLO ReAct                          │    │
│  │                                                          │    │
│  │  Thought → Action → Observation → Thought → ... → Final │    │
│  │                                                          │    │
│  │  Iteraciones máximas: determinadas por LangGraph         │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  TOOLS                                                           │
│  ─────                                                           │
│  ① buscar_trazabilidad(numero_lote: str)                         │
│     └─► sql_tools.buscar_trazabilidad_lote()                     │
│                                                                  │
│  ② crear_borrador(nombre_formulario, datos_json, usuario)        │
│     └─► sql_tools.iniciar_llenado_formulario()                   │
│                                                                  │
│  ③ listar_formularios()                                          │
│     └─► sql_tools.obtener_templates_disponibles()                │
└──────────────────────────────────────────────────────────────────┘
```

### Ciclo de vida de una petición al Agente

```
run_agent(user_message, conversation_history)
│
├─ 1. get_agent()  → singleton (crea si no existe)
│
├─ 2. Construye lista de mensajes:
│      [HumanMessage(historial...), HumanMessage(user_message)]
│
├─ 3. agent.ainvoke({"messages": [...]})
│         │
│         │  LangGraph ReAct Loop:
│         │  ┌────────────────────────────────────────────────┐
│         │  │ Iteración 1:                                   │
│         │  │   LLM lee mensajes + system prompt             │
│         │  │   LLM decide: ¿qué tool llamar?                │
│         │  │   → AIMessage con tool_calls = [...]           │
│         │  │                                                │
│         │  │ Iteración 2:                                   │
│         │  │   LangGraph ejecuta la tool                    │
│         │  │   → ToolMessage(content = resultado SQL)       │
│         │  │                                                │
│         │  │ Iteración 3:                                   │
│         │  │   LLM lee ToolMessage                          │
│         │  │   → AIMessage final (respuesta para el usuario)│
│         │  └────────────────────────────────────────────────┘
│
├─ 4. Extrae de result["messages"]:
│      - tools_used   = [nombre de cada tool llamada]
│      - tool_results = [primeros 500 chars de cada ToolMessage]
│      - final_response = último AIMessage.content
│
└─ 5. Retorna { response, tools_used, tool_results }
```

---

## 5. Flujo Completo: Trazabilidad de un Lote

### Ejemplo: Usuario dice "¿Qué pasó con el lote 260302?"

```
[USUARIO]
  "¿Qué pasó con el lote 260302?"
         │
         ▼ (si es por voz)
[voice.py — transcribe_webm_bytes]
  Audio WebM → archivo .webm temporal → Whisper.transcribe()
  → "¿Qué pasó con el lote 260302?"
         │
         ▼
[server.py — POST /api/ai/agent/voice  o  /api/ai/agent/query]
  Llama a: run_agent("¿Qué pasó con el lote 260302?")
         │
         ▼
[agent.py — LLM Thought]
  El modelo razona:
  "El usuario pregunta por el lote 260302.
   Debo usar la herramienta buscar_trazabilidad."
         │
         ▼
[agent.py — Tool Call]
  buscar_trazabilidad(numero_lote="260302")
         │
         ▼
[sql_tools.py — buscar_trazabilidad_lote("260302")]
  │
  ├─ ETAPA A: Conecta SQL Server
  │
  ├─ ETAPA B: Query LIKE contra FilledForms
  │     SELECT FormID, TemplateID, HeaderData, BodyData,
  │            TemplateSnapshot, CreatedAt, FilledBy, FilledByRole,
  │            TipoProducto, Observaciones
  │     FROM FilledForms
  │     WHERE HeaderData LIKE '%260302%'
  │        OR BodyData   LIKE '%260302%'
  │     ORDER BY CreatedAt ASC
  │
  ├─ ETAPA C: Filtro preciso — _find_lote_in_json()
  │     Recorre el JSON recursivamente buscando campos cuyo
  │     key contenga "lote" y cuyo value == "260302"
  │
  ├─ ETAPA D: Para cada formulario que coincide:
  │     - Parsea TemplateSnapshot → {Codigo, Nombre, Proceso}
  │     - _extract_rows_with_lote(body, "260302")
  │       Busca tablas en BodyData cuyas filas contengan lote=260302
  │
  ├─ ETAPA E: Si no hay FilledForms → busca en FormDrafts
  │
  └─ ETAPA F: Construye narrativa estructurada:
       "TRAZABILIDAD DEL LOTE 260302
        Se encontró en 4 formulario(s):
        --- Paso 1: Recepción de Materia Prima (FOR-CC-42) ---
          Area: Calidad
          Fecha: 2024-03-26 08:15:00
          Registrado por: Ana García (Analista de Calidad)
          ...
        --- Paso 2: Control de Fileteo (FOR-CC-20) ---
          ..."
         │
         ▼
[agent.py — LLM Final Response]
  El modelo recibe el resultado de la tool y redacta la respuesta
  final en español natural, como auditor experto.
  Alerta temperaturas fuera de rango, señala quién firmó, etc.
         │
         ▼
[server.py — Retorna AgentResponse]
  {
    "message": "¿Qué pasó con el lote 260302?",
    "response": "El lote 260302 fue registrado el 26/03/2024...",
    "tools_used": ["buscar_trazabilidad"],
    "tool_results": ["TRAZABILIDAD DEL LOTE 260302..."]
  }
```

---

## 6. Flujo Completo: Llenado de Formulario por Voz

### Ejemplo: "Iniciando control de sellos máquina 2 lote 260318 temperatura 0.8"

```
[USUARIO]
  "Iniciando control de sellos máquina 2 lote 260318 temperatura 0.8"
         │
         ▼ (voice STT)
[voice.py — transcribe_webm_bytes]
  → texto transcrito
         │
         ▼
[agent.py — LLM Thought]
  Razona: "El usuario quiere llenar el formulario de control de sellos.
  Los datos que menciona son:
  - formulario: control de sellos
  - maquina: 2 (VC999#2 o Máquina 2)
  - lote: 260318
  - temperatura: 0.8"
         │
         ▼
[agent.py — Tool Call]
  crear_borrador(
    nombre_formulario = "control de sellos",
    datos_json = '{"lote":"260318","maquina":"2","temperatura":"0.8"}',
    usuario = "Operador FrigoVoice"
  )
         │
         ▼
[agent.py — wrapper crear_borrador()]
  json.loads(datos_json) → datos = {"lote":"260318",...}
  Llama: iniciar_llenado_formulario("control de sellos", datos, usuario)
         │
         ▼
[sql_tools.py — iniciar_llenado_formulario()]
  │
  ├─ ETAPA 1: obtener_esquema_template("control de sellos")
  │     │
  │     ├─ Intenta match por código exacto:
  │     │    SELECT * FROM Templates WHERE Codigo = 'CONTROL DE SELLOS'
  │     │    → no encontrado
  │     │
  │     └─ Fuzzy search por nombre:
  │          SELECT * FROM Templates
  │          WHERE LOWER(Nombre) LIKE '%control de sellos%'
  │          → Encuentra: FOR-CC-10, "Control de Sellos (Empacado al Vacío)"
  │
  ├─ ETAPA 2: Mapeo al Header
  │     Por cada campo en template["header_fields"]:
  │       _match_field_to_data(label, type, datos)
  │       │
  │       └─ keyword_map lookup:
  │            "lote"       → datos["lote"]       = "260318"
  │            "maquina"    → datos["maquina"]     = "2"
  │            "temperatura"→ datos["temperatura"] = "0.8"
  │            "fecha"      → datetime.now()       = "2024-03-26" (auto)
  │            "hora"       → "" (no especificado)
  │       header_data = {
  │         "Lote de Proceso": "260318",
  │         "Máquina": "2",
  │         "Fecha": "2024-03-26",
  │         "Hora Inicio": "",
  │         ...
  │       }
  │
  ├─ ETAPA 3: Mapeo al Body
  │     Por cada elemento en template["body_elements"]:
  │       Si type == "table":
  │         Para cada columna: _match_field_to_data()
  │         Primera fila con datos, + 9 filas vacías
  │       Si type == "section":
  │         Mapea campos de la sección
  │       Si type == "observaciones":
  │         Vacío
  │
  ├─ ETAPA 4: Estructura de Firmas vacías
  │     Por cada puesto en Firmas del template:
  │     firmas_data = {
  │       "Analista de Calidad": {"nombre":"","fecha":"","hora":"","email":""},
  │       "Supervisor": {...}
  │     }
  │
  ├─ ETAPA 5: Construye TemplateSnapshot (espejo del template)
  │
  └─ ETAPA 6: POST /api/FormDrafts
       Payload completo → backend .NET guarda en FormDrafts
       Respuesta: { draftID: 42 }
       │
       └─ Construye mensaje de confirmación:
            "Borrador creado exitosamente.
             ID del borrador: 42
             Formulario: Control de Sellos (FOR-CC-10)
             Área: Calidad
             Datos prellenados:
               - Lote de Proceso: 260318
               - Máquina: 2
               - Temperatura: 0.8
               - Fecha: 2024-03-26
             El operador puede completar el formulario en 'Mis Borradores'."
         │
         ▼
[agent.py — LLM Final Response]
  Resume y confirma al operador qué se registró y qué falta.
```

---

## 7. Estructuras de Datos en Cada Etapa

### 7.1 Evento del Extractor (historial_lotes)

```python
{
    "form_id": 33,
    "template_id": 5,
    "template_codigo": "FOR-CC-10",
    "template_nombre": "Control de sellos (Empacado al Vacío)",
    "proceso": "Calidad",
    "created_at": datetime(2024, 3, 26, 10, 15),
    "filled_by": "Ana García",
    "filled_by_role": "Analista de Calidad",
    "tipo_producto": "Filete de Tilapia",
    "header_data": {
        "Fecha": "2024-03-26",
        "Lote de Proceso": "260302",
        "Máquina": "VC999#2",
        "Turno": "Mañana"
    },
    "body_summary": [
        {"Hora": "10:15", "Temperatura": "0.8", "Sello": "Satisfactorio"},
        {"Hora": "10:30", "Temperatura": "1.2", "Sello": "Satisfactorio"},
    ],
    "lotes_encontrados": [("260302", "BodyData[0].data[0].Lote")]
}
```

### 7.2 Narrativa del Narrator (texto plano para ChromaDB)

```
TRAZABILIDAD DEL LOTE 260302
Fecha de inicio: 26/03/2024
Especie(s): Tilapia
Producto(s): Filete de Tilapia
Procesos involucrados: Recepción de Materia Prima -> Control de Fileteo -> Control de Sellos
Total de registros: 3

--- Paso 1: Recepción de Materia Prima (FOR-CC-42) ---
Registrado el 26/03/2024 a las 07:00 por Carlos López (Operador).
Datos del encabezado: Fecha: 2024-03-26, Proveedor: Pesquero El Mar, Peso: 500 kg
Datos registrados:
  - Temperatura: 2.5, Clasificación: A, Observaciones: Sin novedad

--- Paso 2: Control de Sellos (Empacado al Vacío) (FOR-CC-10) ---
Registrado el 26/03/2024 a las 10:15 por Ana García (Analista de Calidad).
...

Responsables involucrados: Carlos López, Ana García
```

### 7.3 Borrador de Formulario (FormDraft payload)

```json
{
  "templateID": 5,
  "templateName": "Control de Sellos (Empacado al Vacío)",
  "templateCodigo": "FOR-CC-10",
  "userName": "Operador FrigoVoice",
  "userEmail": "",
  "userRole": "operador",
  "headerData": "{\"Lote de Proceso\":\"260318\",\"Máquina\":\"2\",\"Fecha\":\"2024-03-26\"}",
  "bodyData": "[{\"id\":1,\"type\":\"table\",\"data\":[{\"Hora\":\"\",\"Temperatura\":\"0.8\",\"Sello\":\"\"},{...vacío x9}]}]",
  "firmasData": "{\"Analista de Calidad\":{\"nombre\":\"\",\"fecha\":\"\",\"hora\":\"\",\"email\":\"\"}}",
  "templateSnapshot": "{\"TemplateID\":5,\"Codigo\":\"FOR-CC-10\",...}",
  "progress": 10,
  "nota": "Borrador creado por FrigoVoice AI desde dictado de voz"
}
```

### 7.4 Respuesta del Agente

```python
{
    "response": "He creado el borrador del formulario FOR-CC-10...",
    "tools_used": ["crear_borrador"],
    "tool_results": ["Borrador creado exitosamente.\n  ID: 42\n..."]
}
```

---

## 8. Endpoints de la API (FastAPI)

### FASE 1 — RAG + ChromaDB

| Método | Endpoint | Descripción | Módulos usados |
|--------|----------|-------------|---------------|
| `POST` | `/api/ai/query` | Consulta por texto → RAG → LLM | vectorstore + llm_client |
| `POST` | `/api/ai/voice` | Audio → Whisper → RAG → LLM | voice + vectorstore + llm_client |
| `POST` | `/api/ai/audit/{lote}` | Reporte de auditoría por lote | vectorstore + llm_client |
| `GET`  | `/api/ai/lote/{lote}` | Narrativa raw de un lote | vectorstore |
| `GET`  | `/api/ai/search?q=...&n=5` | Búsqueda semántica | vectorstore |
| `GET`  | `/api/ai/stats` | Total documentos en ChromaDB | vectorstore |
| `POST` | `/api/ai/pipeline/run?source=api` | Ejecuta ETL completo | extractor + narrator + vectorstore |

### FASE 2 — Agente con Tool Calling

| Método | Endpoint | Descripción | Módulos usados |
|--------|----------|-------------|---------------|
| `POST` | `/api/ai/agent/query` | Texto → Agente → Tool(s) → Respuesta | agent + sql_tools |
| `POST` | `/api/ai/agent/voice` | Audio → Whisper → Agente → Tool(s) | voice + agent + sql_tools |

### Modelos de Request/Response

```python
# Fase 2 - Request
AgentRequest = { message: str, conversation_history: list[dict] | None }

# Fase 2 - Response (texto)
AgentResponse = {
    message: str,         # Mensaje original del usuario
    response: str,        # Respuesta final del agente
    tools_used: list[str],
    tool_results: list[str]
}

# Fase 2 - Response (voz)
AgentVoiceResponse = {
    transcription: str,
    response: str,
    tools_used: list[str],
    tool_results: list[str]
}
```

---

## 9. Motor de Decisión del Agente ReAct

El agente analiza el mensaje del usuario y decide qué herramienta invocar basándose en el System Prompt:

```
¿El usuario menciona un número de lote?
  ├─ SÍ → buscar_trazabilidad(numero_lote)
  │         Palabras clave: "lote", "trazabilidad", "historia", "pasó con",
  │                         "dónde está", "dame", número de 6 dígitos
  │
  └─ NO → ¿El usuario quiere llenar/registrar/iniciar un formulario?
              ├─ SÍ → crear_borrador(nombre_formulario, datos_json)
              │         Palabras clave: "iniciando", "registrar", "llenar",
              │                         "control de", "fileteo", "recepción",
              │                         nombres de procesos productivos
              │
              └─ NO → ¿El usuario pregunta qué formularios hay?
                          ├─ SÍ → listar_formularios()
                          │         Palabras clave: "qué formularios", "cuáles hay",
                          │                         "disponibles", "códigos"
                          │
                          └─ NO → Responde directamente (saludo, aclaración, etc.)
```

### Ejemplos de frases y herramientas activadas

| Frase del usuario | Herramienta | Parámetros |
|-------------------|-------------|------------|
| "dame la trazabilidad del lote 260302" | `buscar_trazabilidad` | `numero_lote="260302"` |
| "qué pasó con el lote 260318" | `buscar_trazabilidad` | `numero_lote="260318"` |
| "iniciando control de sellos máquina 2 lote 260318" | `crear_borrador` | `nombre="control de sellos"`, `datos={lote,maquina}` |
| "registrar fileteo del lote 260302" | `crear_borrador` | `nombre="fileteo"`, `datos={lote}` |
| "qué formularios hay disponibles" | `listar_formularios` | — |
| "hola, ¿qué puedes hacer?" | (sin tool) | respuesta directa |

---

## 10. Análisis de Cada Herramienta (Tool)

### Tool ①: `buscar_trazabilidad`

```
Definición en agent.py (wrapper @tool):
  buscar_trazabilidad(numero_lote: str) → str

Implementación en sql_tools.py:
  buscar_trazabilidad_lote(numero_lote: str) → str

PIPELINE INTERNO:
  ┌─────────────────────────────────────────────────┐
  │ 1. Validar: numero_lote no vacío                │
  │ 2. Abrir conexión SQL Server (pyodbc)           │
  │ 3. SELECT ... FROM FilledForms                  │
  │    WHERE HeaderData LIKE '%{lote}%'             │
  │       OR BodyData   LIKE '%{lote}%'             │
  │    ORDER BY CreatedAt ASC                       │
  │ 4. Filtro preciso: _find_lote_in_json()         │
  │    - Recorre JSON recursivo                     │
  │    - keys: "lote" en nombre del campo           │
  │    - values: exactamente == numero_lote         │
  │ 5. Por cada match: _extract_rows_with_lote()   │
  │    - Busca tablas en BodyData                   │
  │    - Extrae filas donde lote == numero_lote     │
  │ 6. Si no hay FilledForms → busca FormDrafts     │
  │ 7. Construye string narrativo por pasos         │
  └─────────────────────────────────────────────────┘

Fallback API:
  buscar_trazabilidad_lote_api(numero_lote) → str
  (async, usa httpx, mismo filtrado pero via REST)
```

### Tool ②: `crear_borrador`

```
Definición en agent.py:
  crear_borrador(nombre_formulario, datos_json, usuario) → str

Implementación en sql_tools.py:
  iniciar_llenado_formulario(nombre, datos, usuario) → str

PIPELINE INTERNO:
  ┌─────────────────────────────────────────────────┐
  │ 1. obtener_esquema_template(nombre_formulario)  │
  │    a. Busca por código exacto en Templates      │
  │    b. Si no → fuzzy LIKE por nombre             │
  │    c. Retorna: {header_fields, body_elements,   │
  │                 firmas, template_id, ...}       │
  │                                                 │
  │ 2. Mapear datos al Header                       │
  │    Por cada field en header_fields:             │
  │    _match_field_to_data(label, type, datos)     │
  │    keyword_map: lote→lote, maquina→maquina,...  │
  │    auto-fill fechas con datetime.now()          │
  │                                                 │
  │ 3. Mapear datos al Body                         │
  │    Por cada element en body_elements:           │
  │    • table: crea 10 filas (1 prellenada + 9)    │
  │    • section: mapea campos de sección           │
  │    • observaciones: vacío                       │
  │                                                 │
  │ 4. Crear estructura de Firmas vacías            │
  │                                                 │
  │ 5. Serializar todo a JSON strings               │
  │                                                 │
  │ 6. POST {API_BASE_URL}/FormDrafts               │
  │    → Retorna draftID                            │
  │                                                 │
  │ 7. Construye mensaje de confirmación            │
  │    con campos prellenados y pendientes          │
  └─────────────────────────────────────────────────┘
```

### Tool ③: `listar_formularios`

```
Definición en agent.py:
  listar_formularios() → str

Implementación en sql_tools.py:
  obtener_templates_disponibles() → str

PIPELINE INTERNO:
  ┌─────────────────────────────────────────────────┐
  │ 1. SELECT TemplateID, Codigo, Nombre, Proceso,  │
  │          QuienLoLlena                           │
  │    FROM Templates                               │
  │    WHERE IsObsolete = 0 AND IsDraft = 0         │
  │    ORDER BY Codigo                              │
  │                                                 │
  │ 2. Formatea lista legible:                      │
  │    "- ID:5 | FOR-CC-10 | Control de Sellos |   │
  │      Area: Calidad | Llena: Analista"           │
  └─────────────────────────────────────────────────┘
```

---

## 11. Formularios: Estructura y Etapas de Llenado

### Ciclo de vida de un formulario

```
ESTADO 1: Template (plantilla)
  Templates → {Codigo, Nombre, HeaderFields (JSON), BodyElements (JSON), Firmas (JSON)}
       │
       │ (usuario inicia llenado — manual o por voz)
       ▼
ESTADO 2: FormDraft (borrador)
  FormDrafts → {DraftID, TemplateID, TemplateName, TemplateCodigo,
                UserName, HeaderData, BodyData, FirmasData,
                TemplateSnapshot, Progress %, Nota, IsActive, CreatedAt}
       │
       │ (usuario completa y envía)
       ▼
ESTADO 3: FilledForm (formulario completado)
  FilledForms → {FormID, TemplateID, HeaderData, BodyData,
                 TemplateSnapshot, FilledBy, FilledByRole,
                 TipoProducto, Observaciones, CreatedAt}
```

### Formularios disponibles (config.py)

| Código | Nombre del Proceso | Área |
|--------|-------------------|------|
| FOR-CC-42 | Recepción de Materia Prima | Calidad |
| FOR-CC-20 | Control de Fileteo para Congelación | Producción |
| FOR-CC-10 | Control de Sellos (Empacado al Vacío) | Calidad |
| FOR-CC-06 | Control de Empaque Final | Producción |
| FOR-CC-04 | Control de Temperatura en Cámaras | Calidad |
| FOR-CC-08 | Control de Limpieza y Desinfección | Calidad |
| FOR-CC-12 | Control de Glaseo | Producción |
| FOR-CC-14 | Control de Peso | Calidad |

### Estructura interna del BodyElements (JSON)

```json
[
  {
    "id": 1,
    "type": "table",
    "columns": [
      {"label": "Hora", "type": "time"},
      {"label": "Temperatura", "type": "number"},
      {"label": "Sello", "type": "select", "options": ["Satisfactorio", "No Conforme"]},
      {"label": "Máquina", "type": "text"},
      {"label": "Observaciones", "type": "text"}
    ],
    "data": []
  },
  {
    "id": 2,
    "type": "section",
    "fields": [
      {"label": "Lote de Proceso", "type": "text"},
      {"label": "Producto", "type": "text"},
      {"label": "Turno", "type": "select"}
    ]
  },
  {
    "id": 3,
    "type": "observaciones"
  }
]
```

### Mapeo de voz a campos del formulario (_match_field_to_data)

```
Campos del formulario    Palabras clave detectadas en voz
─────────────────────    ─────────────────────────────────
Fecha                 ←  fecha
Hora / Hora Inicio    ←  hora, hora_inicio, hora_final
Lote de Proceso       ←  lote, lote_proceso, numero_lote
Máquina               ←  maquina, tipo_maquina
Producto/Presentación ←  producto, presentacion, tipo_producto
Especie               ←  especie
Temperatura           ←  temperatura
Peso / Peso Neto      ←  peso, peso_neto, total_lbs
% Glaseo              ←  glaseo, porcentaje_glaseo
Cajas / Total Cajas   ←  caja, cajas, total_cajas
Tinas                 ←  tina, tinas
Turno                 ←  turno
Observaciones         ←  observacion, observaciones
Empaques Inspeccionados← empaques, empaques_inspeccionados
Sellos                ←  sellos, sellos_satisfactorios
No. Rollo             ←  rollo, rollo_numero
Inspección            ←  inspeccion, prueba
```

---

## 12. Esquema de Base de Datos Implícito

```sql
-- Plantillas de formularios
CREATE TABLE Templates (
    TemplateID      INT         PRIMARY KEY,
    Codigo          VARCHAR(20) NOT NULL,   -- "FOR-CC-10"
    Nombre          VARCHAR(200),
    Version         VARCHAR(10),
    Proceso         VARCHAR(100),
    QuienLoLlena    VARCHAR(100),
    HeaderFields    NVARCHAR(MAX),          -- JSON array de campos del header
    BodyElements    NVARCHAR(MAX),          -- JSON array de tablas/secciones
    Firmas          NVARCHAR(MAX),          -- JSON array de firmantes requeridos
    IsObsolete      BIT DEFAULT 0,
    IsDraft         BIT DEFAULT 0
);

-- Formularios completados
CREATE TABLE FilledForms (
    FormID           INT          PRIMARY KEY IDENTITY,
    TemplateID       INT,
    HeaderData       NVARCHAR(MAX),          -- JSON con valores del encabezado
    BodyData         NVARCHAR(MAX),          -- JSON con tablas/secciones llenadas
    TemplateSnapshot NVARCHAR(MAX),          -- Copia del template al momento de llenar
    FilledBy         VARCHAR(200),
    FilledByRole     VARCHAR(100),
    TipoProducto     VARCHAR(200),
    Observaciones    NVARCHAR(MAX),
    CreatedAt        DATETIME DEFAULT GETDATE()
);

-- Borradores en progreso (por voz o manual)
CREATE TABLE FormDrafts (
    DraftID           INT         PRIMARY KEY IDENTITY,
    TemplateID        INT,
    TemplateName      VARCHAR(200),
    TemplateCodigo    VARCHAR(20),
    UserName          VARCHAR(200),
    UserEmail         VARCHAR(200),
    HeaderData        NVARCHAR(MAX),
    BodyData          NVARCHAR(MAX),
    FirmasData        NVARCHAR(MAX),
    TemplateSnapshot  NVARCHAR(MAX),
    Progress          INT,                  -- % de completitud
    Nota              NVARCHAR(500),
    IsActive          BIT DEFAULT 1,
    CreatedAt         DATETIME DEFAULT GETDATE()
);
```

---

## 13. Diagrama de Secuencia — Consulta por Voz (Agente)

```
Operador    Browser    FastAPI     Whisper    LangGraph    Ollama     SQL Server
   │           │          │           │           │           │           │
   │──Audio───►│          │           │           │           │           │
   │           │──WebM───►│           │           │           │           │
   │           │          │──bytes───►│           │           │           │
   │           │          │          │transcribe  │           │           │
   │           │          │◄──texto──│           │           │           │
   │           │          │──texto──────────────►│           │           │
   │           │          │          │         ainvoke        │           │
   │           │          │          │           │──prompt───►│           │
   │           │          │          │           │◄─tool_call─│           │
   │           │          │          │           │──SQL──────────────────►│
   │           │          │          │           │◄──resultados──────────│
   │           │          │          │           │──resultado─►│          │
   │           │          │          │           │◄──respuesta─│          │
   │           │          │◄─────────────────────│           │           │
   │           │◄─response─│          │           │           │           │
   │◄──texto───│          │           │           │           │           │
   │  (TTS en  │          │           │           │           │           │
   │  browser) │          │           │           │           │           │
```

---

## 14. Problemas Detectados y Mejoras Propuestas

### Problemas detectados

| # | Archivo | Problema | Impacto |
|---|---------|---------|---------|
| 1 | `sql_tools.py` | `buscar_trazabilidad_lote_api` es `async` pero se llama desde código sync (agent.py espera strings) | Potencial error si se usa como fallback |
| 2 | `agent.py` | La instancia del agente es singleton global. Si el System Prompt cambia de fecha (se formatea al crear), el agente puede quedar con fecha obsoleta en memoria | Solo se recrea al reiniciar el servidor |
| 3 | `sql_tools.py` | En `crear_borrador`, las tablas siempre generan 10 filas (1 prellenada + 9 vacías). Si el template necesita más o menos, esto no es configurable | Inflexibilidad en formularios |
| 4 | `server.py` | CORS permite `"*"` → cualquier origen puede llamar la API | Riesgo de seguridad en producción |
| 5 | `sql_tools.py` | Las queries LIKE `%lote%` pueden ser lentas en tablas grandes sin índices Full-Text | Performance degradada con muchos registros |
| 6 | `agent.py` | `tool_results` truncados a 500 chars — el LLM no ve el resultado completo de trazabilidades largas | Respuestas incompletas |
| 7 | `voice.py` | `transcribe_webm_bytes` usa archivos temporales que se borran con `os.unlink` pero no hay cleanup si Whisper falla antes del `finally` | Archivos temporales huérfanos |

### Mejoras propuestas

```python
# 1. Regenerar System Prompt en cada llamada (no solo al crear el agente)
async def run_agent(user_message: str, ...):
    agent = get_agent()
    # Inyectar fecha fresca por mensaje
    dated_message = f"[{datetime.now().strftime('%d/%m/%Y %H:%M')}] {user_message}"
    ...

# 2. Límite configurable de filas en borrador
def iniciar_llenado_formulario(..., num_filas: int = 10):
    rows = [row] + [empty_row.copy() for _ in range(num_filas - 1)]

# 3. CORS restrictivo en producción
app.add_middleware(CORSMiddleware,
    allow_origins=["https://frigolab.com", "http://localhost:5173"],
    ...
)

# 4. Índice Full-Text en SQL Server para mejorar búsquedas
# CREATE FULLTEXT INDEX ON FilledForms(HeaderData, BodyData)
# ...luego usar CONTAINS en lugar de LIKE

# 5. Pasar resultados completos al LLM (no truncados a 500)
tool_results.append(msg.content)  # Quitar el [:500]
```

---

## Resumen ejecutivo del flujo completo

```
FLUJO TRAZABILIDAD          FLUJO FORMULARIO POR VOZ
───────────────────         ────────────────────────
🎤 Voz/Texto                🎤 Voz/Texto
     ↓                           ↓
  Whisper STT              Whisper STT
     ↓                           ↓
  FastAPI                    FastAPI
     ↓                           ↓
  LangChain                 LangChain
  ReAct Agent               ReAct Agent
     ↓                           ↓
  Tool: buscar_trazabilidad  Tool: crear_borrador
     ↓                           ↓
  SQL Server                SQL Server (Templates)
  FilledForms               + API REST (FormDrafts)
     ↓                           ↓
  Narrativa estructurada     Borrador prellenado
     ↓                           ↓
  LLM redacta respuesta      LLM confirma datos
     ↓                           ↓
  Texto en español 🗣️         Texto en español 🗣️
  (TTS en frontend)          (TTS en frontend)
```
