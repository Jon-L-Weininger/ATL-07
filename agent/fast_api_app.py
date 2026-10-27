# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import contextlib
import os
from collections.abc import AsyncIterator
from pathlib import Path

from a2a.server.tasks import InMemoryTaskStore
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from google.adk.cli.fast_api import get_fast_api_app
from google.adk.runners import Runner

from agent.app_utils import services
from agent.app_utils.a2a import attach_a2a_routes
from agent.server import (
    api_create_posting,
    api_equity_audit,
    api_get_postings,
    api_match_brief,
    api_status,
    chat_endpoint,
)

load_dotenv()
allow_origins = (
    os.getenv("ALLOW_ORIGINS", "").split(",") if os.getenv("ALLOW_ORIGINS") else None
)
otel_to_cloud = True

AGENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    from agent.agent import app as adk_app
    from agent.agent import root_agent

    runner = Runner(
        app=adk_app,
        session_service=services.get_session_service(),
        artifact_service=services.get_artifact_service(),
        auto_create_session=True,
    )
    app.state.runner = runner
    app.state.agent_app_name = adk_app.name
    await attach_a2a_routes(
        app,
        agent=root_agent,
        runner=runner,
        task_store=InMemoryTaskStore(),
        rpc_path=f"/a2a/{adk_app.name}",
    )
    yield


app: FastAPI = get_fast_api_app(
    agents_dir=AGENT_DIR,
    web=True,
    artifact_service_uri=services.ARTIFACT_SERVICE_URI,
    allow_origins=allow_origins,
    session_service_uri=services.SESSION_SERVICE_URI,
    otel_to_cloud=otel_to_cloud,
    lifespan=lifespan,
)
app.title = "a4i-food-broker"
app.description = "API for interacting with the Agent a4i-food-broker"

# Register ATL-07 Coordinator Console API endpoints on the unified FastAPI app
app.add_api_route("/api/status", api_status, methods=["GET"])
app.add_api_route("/api/postings", api_get_postings, methods=["GET"])
app.add_api_route("/api/postings", api_create_posting, methods=["POST"])
app.add_api_route("/api/match-brief", api_match_brief, methods=["POST"])
app.add_api_route("/api/equity-audit", api_equity_audit, methods=["GET"])
app.add_api_route("/api/chat", chat_endpoint, methods=["POST"])

# Serve the compiled React Coordinator UI (frontend/dist) at `/` when built,
# while preserving `/dev-ui/` for the ADK Web Playground.
_FRONTEND_DIST = Path(AGENT_DIR) / "frontend" / "dist"
if (_FRONTEND_DIST / "index.html").is_file():
    app.router.routes = [
        r for r in app.router.routes if getattr(r, "path", None) != "/"
    ]
    if (_FRONTEND_DIST / "assets").is_dir():
        app.mount(
            "/assets",
            StaticFiles(directory=str(_FRONTEND_DIST / "assets")),
            name="frontend_assets",
        )

    @app.get("/", include_in_schema=False)
    async def serve_coordinator_ui() -> FileResponse:
        return FileResponse(str(_FRONTEND_DIST / "index.html"))


# Main execution
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
