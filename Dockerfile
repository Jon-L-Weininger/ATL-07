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

FROM node:20-slim AS frontend-builder

WORKDIR /frontend
COPY ./frontend/package.json ./frontend/package-lock.json* ./
RUN npm ci
COPY ./frontend ./
RUN npm run build

FROM python:3.12-slim

# Install curl + ca-certificates and download MCP Toolbox for Databases (v0.20.0)
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL https://storage.googleapis.com/genai-toolbox/v0.20.0/linux/amd64/toolbox -o /usr/local/bin/toolbox \
    && chmod +x /usr/local/bin/toolbox \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:0.8.13 /uv /uvx /bin/

WORKDIR /code

COPY ./pyproject.toml ./README.md ./uv.lock* ./

COPY ./agent ./agent
COPY --from=frontend-builder /frontend/dist ./frontend/dist

RUN uv sync --frozen

ARG AGENT_VERSION=0.0.0
ENV AGENT_VERSION=${AGENT_VERSION}
ENV GOOGLE_CLOUD_PROJECT=qwiklabs-gcp-04-e7160ff57547
ENV GOOGLE_CLOUD_LOCATION=us-central1
ENV GOOGLE_GENAI_USE_VERTEXAI=TRUE
ENV USE_VECTOR_SEARCH=true
ENV MCP_TOOLBOX_URL=http://127.0.0.1:5000/mcp/food_broker_toolset

EXPOSE 8080

CMD ["sh", "-c", "/usr/local/bin/toolbox --tools-file /code/agent/tools.yaml --address 127.0.0.1 --port 5000 & sleep 1 && exec uv run uvicorn agent.fast_api_app:app --host 0.0.0.0 --port ${PORT:-8080}"]
