"""Configuration and backend service toggles for ATL-07 Surplus Broker."""

import os

# Toggle between deterministic offline mock data ("true") and live
# BigQuery tables in qwiklabs-gcp-04-e7160ff57547.a4i_food ("false").
# Default is now "false" since the real BigQuery tables are populated!
USE_MOCK_BACKEND: bool = os.getenv("USE_MOCK_BACKEND", "false").lower() in ("true", "1", "yes")

# Toggle for BigQuery VECTOR_SEARCH + AI.EMBED.
# Default is "false" while `recipients` does not yet have a `profile_embedding` column.
USE_VECTOR_SEARCH: bool = os.getenv("USE_VECTOR_SEARCH", "false").lower() in ("true", "1", "yes")

# Google Cloud & BigQuery settings (matching live GCP project & dataset)
GOOGLE_CLOUD_PROJECT: str = os.getenv("GOOGLE_CLOUD_PROJECT", "qwiklabs-gcp-04-e7160ff57547")
BQ_DATASET: str = os.getenv("BQ_DATASET", "a4i_food")
BQ_LOCATION: str = os.getenv("BQ_LOCATION", "US")
EMBED_ENDPOINT: str = os.getenv("EMBED_ENDPOINT", "gemini-embedding-2")
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# Managed MCP Server / MCP Toolbox for Databases placeholder endpoint
MCP_TOOLBOX_URL: str = os.getenv("MCP_TOOLBOX_URL", "http://localhost:5000/mcp")

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


def get_backend_status() -> dict:
    """Return connection readiness status for the UI Backend Placeholder Inspector."""
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
                    "a4i_food.recipients_demographics (127 rows pre-joined to nearest Census tract)",
                    "a4i_food.surplus_postings (10 rows: 4 RETAIL, 3 FARM, 3 ESSENTIALS)",
                    "a4i_food.shelf_life (661 rows: USDA FoodKeeper CC0)",
                    "a4i_food.tract_demographics (165 rows: Georgia Census Tracts)",
                ],
                "file_hook": "agent/atl_broker/tools.py::_load_live_bq_corpus",
            },
            {
                "id": "vector_search",
                "name": "BigQuery VECTOR_SEARCH + AI.EMBED",
                "status": (
                    "connected"
                    if (not USE_MOCK_BACKEND and USE_VECTOR_SEARCH)
                    else "placeholder (no vector index yet — profile/text scorer active)"
                ),
                "env_var": "USE_VECTOR_SEARCH / EMBED_ENDPOINT",
                "current_value": f"USE_VECTOR_SEARCH={USE_VECTOR_SEARCH} ({EMBED_ENDPOINT})",
                "tables": [
                    "Pending: ALTER TABLE a4i_food.recipients ADD COLUMN profile_embedding",
                    "Fallback active: hybrid profile_text semantic scorer + hard SQL/Python post-filters",
                ],
                "file_hook": "agent/atl_broker/tools.py::search_and_filter_recipients",
            },
            {
                "id": "mcp_server",
                "name": "Managed MCP Server / Toolbox for Databases",
                "status": "placeholder",
                "env_var": "MCP_TOOLBOX_URL",
                "current_value": MCP_TOOLBOX_URL,
                "tables": [
                    "MCP tools: lookup_shelf_life_clock, search_and_filter_recipients, get_tract_equity_context"
                ],
                "file_hook": "agent/atl_broker/agent.py",
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
