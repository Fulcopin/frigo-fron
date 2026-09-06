## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>" --budget 4000` when graphify-out/graph.json exists (the default 2000 budget truncates). Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Skip the query only when the target files are already mapped in the current session's context — don't re-query what you already know.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- The PreToolUse hook-guard nudges were removed on purpose (they injected ~30 tokens on every Grep/Read); these rules replace them. Do not re-add the hooks.
- Keep the corpus clean: dead docs and one-off patch files live in `out/archivo/` (a folder graphify never scans). New status .md files should go there, not the repo root.
