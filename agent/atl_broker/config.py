"""Configuration and backend service toggles for ATL-07 Surplus Broker."""

import os

# Toggle between deterministic offline mock data ("true") and live
# BigQuery tables in qwiklabs-gcp-04-e7160ff57547.a4i_food ("false").
# Default is now "false" since the real BigQuery tables are populated!
USE_MOCK_BACKEND: bool = os.getenv("USE_MOCK_BACKEND", "false").lower() in ("true", "1", "yes")

# Toggle for BigQuery VECTOR_SEARCH + ML.GENERATE_EMBEDDING on `a4i_food.recipient_embeddings`.
# Default is "true" since `a4i_food.recipient_embeddings` (127 rows, gemini-embedding-2) is materialized!
USE_VECTOR_SEARCH: bool = os.getenv("USE_VECTOR_SEARCH", "true").lower() in ("true", "1", "yes")

# Google Cloud & BigQuery settings (matching live GCP project & dataset)
GOOGLE_CLOUD_PROJECT: str = os.getenv("GOOGLE_CLOUD_PROJECT", "qwiklabs-gcp-04-e7160ff57547")
BQ_DATASET: str = os.getenv("BQ_DATASET", "a4i_food")
BQ_LOCATION: str = os.getenv("BQ_LOCATION", "US")
EMBED_ENDPOINT: str = os.getenv("EMBED_ENDPOINT", "gemini-embedding-2")
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# Managed MCP Server / MCP Toolbox for Databases endpoint
MCP_TOOLBOX_URL: str = os.getenv(
    "MCP_TOOLBOX_URL", "http://127.0.0.1:5000/mcp/food_broker_toolset"
)

# Atlanta Metro & Track settings
METRO_NAME: str = "Atlanta"
METRO_STATE: str = "GA"
METRO_BOUNDS = {
    "lat_min": 33.55,
    "lat_max": 33.92,
    "lon_min": -84.55,
    "lon_max": -84.28,
}
PRIMARY_TRACK: str = "RETAIL"
STRETCH_TRACK: str = "ESSENTIALS"

# Live Atlanta metro baseline computed from `qwiklabs-gcp-04-e7160ff57547.a4i_food.tract_demographics`
# (165 Georgia census tracts, 118 real IRS organizations + 9 planted teaching cases = 127 rows)
ATLANTA_METRO_BASELINE = {
    "metro": "Atlanta, GA",
    "irs_orgs_count": 118,
    "planted_cases_count": 9,
    "total_corpus_rows": 127,
    "tracts_count": 165,
    "no_vehicle_rate": 0.1283,   # 12.8% (~13%) population-weighted no-vehicle rate across 165 tracts
    "poverty_rate": 0.1879,      # 18.8% population-weighted poverty rate across 165 tracts
    "assistance_rate": 0.1803,   # 18.0% population-weighted SNAP/assistance rate across 165 tracts
}


def _is_mcp_toolbox_online() -> bool:
    """Quick socket check to see if MCP Toolbox for Databases is listening on port 5000."""
    import socket
    from urllib.parse import urlparse

    try:
        parsed = urlparse(MCP_TOOLBOX_URL)
        host = parsed.hostname or "127.0.0.1"
        port = parsed.port or 5000
        with socket.create_connection((host, port), timeout=0.35):
            return True
    except OSError:
        return False


def get_backend_status() -> dict:
    """Return connection readiness status for the UI Backend Placeholder Inspector."""
    mcp_online = _is_mcp_toolbox_online()
    return {
        "mode": "mock" if USE_MOCK_BACKEND else "live",
        "use_mock_backend": USE_MOCK_BACKEND,
        "use_vector_search": USE_VECTOR_SEARCH,
        "metro": f"{METRO_NAME}, {METRO_STATE}",
        "primary_track": PRIMARY_TRACK,
        "stretch_track": STRETCH_TRACK,
        "baseline": ATLANTA_METRO_BASELINE,
        "services": [
            {
                "id": "bq_dataset",
                "name": "BigQuery Dataset (a4i_food — Real Tables)",
                "status": "placeholder" if USE_MOCK_BACKEND else "connected (live BigQuery)",
                "env_var": "GOOGLE_CLOUD_PROJECT / BQ_DATASET",
                "current_value": f"{GOOGLE_CLOUD_PROJECT}.{BQ_DATASET} ({BQ_LOCATION})",
                "tables": [
                    "a4i_food.recipients (127 rows: 118 real Atlanta IRS orgs + 9 planted cases)",
                    "a4i_food.recipient_embeddings (127 rows pre-joined to nearest Census tract + gemini-embedding-2)",
                    "a4i_food.surplus_postings (10 rows: 4 RETAIL, 3 FARM, 3 ESSENTIALS)",
                    "a4i_food.shelf_life (661 rows: USDA FoodKeeper CC0)",
                    "a4i_food.tract_demographics (165 rows: Georgia Census Tracts)",
                ],
                "file_hook": "agent/atl_broker/tools.py::_ensure_bq_loaded",
            },
            {
                "id": "vector_search",
                "name": "BigQuery VECTOR_SEARCH + ML.GENERATE_EMBEDDING",
                "status": (
                    "connected (a4i_food.recipient_embeddings + gemini-embedding-2)"
                    if (not USE_MOCK_BACKEND and USE_VECTOR_SEARCH)
                    else "placeholder (profile/text scorer active)"
                ),
                "env_var": "USE_VECTOR_SEARCH / EMBED_ENDPOINT",
                "current_value": f"USE_VECTOR_SEARCH={USE_VECTOR_SEARCH} ({EMBED_ENDPOINT})",
                "tables": [
                    "Active: a4i_food.recipient_embeddings (embedding ARRAY<FLOAT64>, us.vertex_ai)",
                    "Post-filter: hard SQL/Python cold-chain, capacity, clock & contradiction checks",
                ],
                "file_hook": "agent/atl_broker/tools.py::search_and_filter_recipients",
            },
            {
                "id": "mcp_server",
                "name": "MCP Toolbox for Databases (food_broker_toolset)",
                "status": (
                    "connected (MCP Toolbox :5000)"
                    if mcp_online
                    else "standby (start toolbox --tools-file agent/tools.yaml --ui)"
                ),
                "env_var": "MCP_TOOLBOX_URL",
                "current_value": MCP_TOOLBOX_URL,
                "tables": [
                    "MCP tools: list_surplus_postings, get_surplus_posting, search_shelf_life, match_recipients_vector"
                ],
                "file_hook": "agent/tools.yaml & agent/atl_broker/agent.py",
            },
            {
                "id": "adk_chat",
                "name": "ADK Coordinator Agent & SSE Chat Stream",
                "status": "connected (live BigQuery tables)" if not USE_MOCK_BACKEND else "placeholder_active",
                "env_var": "GEMINI_MODEL / USE_MOCK_BACKEND",
                "current_value": f"{GEMINI_MODEL} (live BigQuery context)",
                "tables": ["POST /api/chat (THOUGHT, FINAL_RESPONSE, SUGGESTION)"],
                "file_hook": "agent/server.py::chat_endpoint",
            },
        ],
    }
