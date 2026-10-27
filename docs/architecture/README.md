# ATL-07 Architecture Documentation

Welcome to the architectural documentation for the **ATL-07 Resilient Food Equity & Surplus Broker**.

This directory contains two complementary architectural maps tailored for different audiences:

---

## 1. [Executive Architecture Blueprint](executive_architecture.md)
> **Audience**: Leadership, Executive Stakeholders, Evaluators, and Presentation Decks.

- **Strategic Focus**: Mission statement, core value propositions, and operational impact.
- **Architectural Diagram**: High-level, presentation-grade Mermaid diagram covering Omnichannel Experiences, Service Gateway, ADK/Vertex AI Core, Deterministic Guardrails, Enterprise BigQuery Data Fabric, and Cloud Run Infrastructure.
- **Strategic Pillars**: Spatial Equity Intelligence, Deterministic Cold-Chain Safety, Sub-Minute Autonomous Dispatch, and Enterprise Cloud-Native Foundation.
- **Journey & Scorecard**: End-to-end donor/coordinator/recipient flow and technical KPIs (<15s decision latency, 100% trap rejection, 3,072-dim vector precision).

---

## 2. [Technical Architecture Map](technical_architecture.md)
> **Audience**: Software Engineers, Solutions Architects, and Technical Evaluators.

- **Deep-Dive Topology**: Component flow mapping React 18 UI components (`App.tsx`, `SpatialEquityMap.tsx`, `ChatPanel.tsx`, `EquityAuditChart.tsx`), FastAPI routes, ADK agent/subagents, GenAI MCP Toolbox daemon, and BigQuery schemas.
- **Session Hub Grounding**: Live developer session registry and inter-session coordination via Antigravity Session Hub.
- **Logistics & Guardrail Engine**: Detailed inspection of `agent/custom_tools.py` resolving all 9 planted edge-cases (*Greenline* near-miss decoy, *Harborview* contradiction, *Cedar* vs *Maple* equity tie-breaker, vocabulary bridges, and pallet load-splitting).
- **Data & Vector Pipeline**: Schema breakdowns for `a4i_food` BigQuery tables, `AI.EMBED` materialization queries, and `VECTOR_SEARCH` SQL statements.
- **Container Runtime**: Multi-stage Docker packaging, co-process startup (`toolbox` on `:5000` + Uvicorn on `:8080`), and Cloud Run production specs.
