# CLAUDE.md — NarrativeOS

AI-assisted novel writing system. Python/FastAPI backend + React/TypeScript frontend + Neo4j knowledge graph.

---

## Project Structure

```
narrative-os/
├── agent/              # LLM pipeline (director, writer, consistency)
├── backend/            # FastAPI + WebSocket server
│   ├── routes/         # REST API endpoints
│   └── websocket/      # WebSocket handler + message protocol
├── frontend/           # React + TypeScript (Vite), port 5173
│   └── src/
│       ├── components/ # UI components (AgentChat, ChapterTree, KGContextPanel, etc.)
│       ├── pages/      # Dashboard, Workspace, KGManager, LogViewer
│       ├── hooks/      # useWebSocket
│       ├── store/      # Zustand state (sessionStore.ts)
│       └── types/      # TypeScript interfaces (messages.ts)
├── kg/                 # Neo4j schema (Pydantic), CRUD, driver client
├── mcp_server/         # FastMCP server exposing KG tools to external agents
├── scripts/            # CLI (cli.py), seed data, MCP test scripts
├── docs/               # Screenshots
├── docker-compose.yml  # Neo4j + backend services
├── requirements.txt    # Python dependencies
└── .env.example        # Environment variable template
```

---

## Architecture

**Request flow:**
1. Browser ↔ WebSocket (`/ws/project/{project_id}`) ↔ `backend/websocket/handler.py`
2. Handler bridges messages to `backend/narrative_loop.py` via `asyncio.Queue`
3. Narrative loop calls `agent/director.py` (LLM) which reads from `kg/crud.py` (Neo4j)
4. REST API (`/api/...`) handles CRUD for projects, chapters, scenes, KG entities, exports, logs

**Key design patterns:**
- `narrative_loop.py` is I/O-agnostic — used by both the WebSocket handler and `scripts/cli.py`
- Neo4j CRUD uses `MERGE` for idempotent upserts; helper `_to_props()` converts Pydantic models to safe dicts
- All Python async throughout (`asyncio`, `neo4j` async driver, `litellm.acompletion`)
- WebSocket: one connection per project session; graceful cleanup on disconnect

---

## Development Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker (for Neo4j)

### Backend
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start Neo4j
docker compose up neo4j -d

# Start backend (from repo root)
uvicorn backend.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev   # Vite dev server on http://localhost:5173
```

### Environment Variables
Copy `.env.example` to `.env` and fill in:
```
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=...
GEMINI_API_KEY=...       # Primary LLM (required)
ANTHROPIC_API_KEY=...    # Optional
OPENAI_API_KEY=...       # Optional
```

---

## CI/CD

**GitHub Actions** (`.github/workflows/ci.yml`), runs on push/PR to `main`/`master`:

| Job | What it does |
|-----|-------------|
| Frontend | `npm ci` → `tsc && vite build` |
| Backend | `ruff check agent/ backend/ kg/ mcp_server/ scripts/` + import validation |

**To verify CI locally:**
```bash
# Backend lint
ruff check agent/ backend/ kg/ mcp_server/ scripts/

# Frontend build
cd frontend && npm run build

# Import check
python -c "from agent import director, config, consistency, logger, tools; print('OK')"
python -c "from kg import schema, crud, client; print('OK')"
python -c "from backend import main; print('OK')"
```

---

## Code Conventions

### Python
- Python 3.11+ syntax and type hints throughout
- `from __future__ import annotations` at top of files
- Async/await everywhere — no blocking I/O in async paths
- Pydantic v2 models for all data structures; UUIDs for IDs, ISO datetimes for timestamps
- Docstrings include context and design notes (not just signatures)
- Ruff for linting — fix any lint errors before committing
- No `pyproject.toml` — Ruff is invoked directly with directory targets

### TypeScript/React
- React 18 functional components with hooks only (no class components)
- Zustand for global state (`frontend/src/store/sessionStore.ts`)
- `useWebSocket` hook wraps all WebSocket communication
- TipTap v3 for rich-text editing; scene content stored as HTML
- No testing framework — CI validates via TypeScript compile + Vite build

### Knowledge Graph Schema
The KG (`kg/schema.py`) has 5 layers:
1. **Project** — `ProjectNode`
2. **Story structure** — `StoryArcNode`, `ActNode`, `ChapterNode`, `SceneNode`
3. **Character psychology (GOLEM)** — `CharacterNode` with `core_desire`, `core_fear`, `wound`, `belief`, `moral_code`
4. **World** — `FactionNode`, `LocationNode`, `WorldEventNode`, `PlotThreadNode`, `ArtifactNode`
5. **Analysis** — `NoteNode`

Edges: `CharacterRelationshipEdge` (trust_level -100..100), `FactionRelationshipEdge` (tension_level 1..10)

Default `language` for `ProjectNode` is `"zh"` (Chinese).

---

## LLM Configuration (`agent/config.py`)

All LLM calls go through `agent.config.chat()` or `agent.config.stream_chat()`.

**Task → Model mapping** (`TASK_MODEL_MAP`):
- All tasks currently use `gemini/gemini-3.1-flash-lite-preview`
- Tasks: `director`, `write_scene`, `dialogue`, `consistency`, `summary`, `timeline`

**Fallback chain** (tried in order on retryable errors):
1. `gemini/gemini-1.5-flash`
2. `gemini/gemini-1.5-flash-8b`

**Retryable errors:** 503, 529, 429, rate limit, quota exceeded, `resource_exhausted`

When adding a new agent task:
1. Add an entry to `TASK_MODEL_MAP` in `agent/config.py`
2. Call `agent.config.chat(task="your_task", messages=[...])` or `stream_chat()`

---

## API Endpoints

```
GET  /health
GET  /api/projects/
POST /api/projects/
GET  /api/projects/{id}
GET  /api/projects/{id}/chapters
POST /api/projects/{id}/chapters
GET  /api/chapters/{id}/scenes
POST /api/chapters/{id}/scenes
GET  /api/projects/{id}/kg/characters
GET  /api/projects/{id}/kg/locations
GET  /api/projects/{id}/kg/factions
GET  /api/projects/{id}/kg/plot-threads
GET  /api/projects/{id}/kg/artifacts
GET  /api/projects/{id}/analysis
GET  /api/export/{id}
GET  /api/logs
WS   /ws/project/{project_id}
```

---

## MCP Server (`mcp_server/`)

Exposes KG and agent capabilities as FastMCP tools for external AI agents:
- **Query tools** (read-only): `query_character()`, `get_active_foreshadowing()`, `get_character_relationship()`
- **Generate tools** (LLM-powered): dialogue generation, POV suggestions
- **Check tools**: consistency checks, voice validation
- **Update tools**: suggest KG mutations, apply updates

Run with: `python mcp_server/server.py`

---

## Structured Logging (`agent/logger.py`)

`AgentLogger` writes JSONL to `logs/`. Each record includes:
- `action`, `tools_called`, `kg_nodes`, `model`, `tokens`, `latency_ms`

Logs are viewable in the frontend `LogViewer` page and via `GET /api/logs`.

---

## Docker

```bash
# Full stack (Neo4j + backend)
docker compose up

# Neo4j only (for local backend dev)
docker compose up neo4j -d
# Neo4j browser UI: http://localhost:7474
# Bolt: bolt://localhost:7687
```

Backend Dockerfile: `backend/Dockerfile` (Python 3.12-slim, uvicorn).

---

## Testing

No automated unit/integration test suite. Manual testing tools:
- `scripts/seed_test_data.py` — populates Neo4j with sample story data
- `scripts/test_mcp_tools.py` — exercises MCP tool integration
- `scripts/cli.py` — command-line interface to the narrative loop

---

## Common Tasks

**Add a new REST route:**
1. Create `backend/routes/your_feature.py` with a `router = APIRouter()`
2. Register it in `backend/main.py`: `app.include_router(your_router)`

**Add a new KG entity type:**
1. Add a Pydantic model to `kg/schema.py` following the layered structure
2. Add CRUD methods to `kg/crud.py` using `_merge_node()`, `_get_node()`, `_list_nodes()`
3. Add a Neo4j constraint/index to `kg/client.py` `init_schema()`
4. Expose via a new route in `backend/routes/kg.py`

**Change the LLM model for a task:**
- Edit `TASK_MODEL_MAP` in `agent/config.py`

**Add a frontend page:**
1. Create `frontend/src/pages/YourPage.tsx`
2. Add a route in `frontend/src/App.tsx`
