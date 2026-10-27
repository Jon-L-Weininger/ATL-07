"""Hybrid Vector + BM25 Search Engine with RRF and Vertex AI Semantic Reranker.

Implements the end-to-end enhanced retrieval and matching pipeline for ATL-07:
1. Dense Vector Search: BigQuery VECTOR_SEARCH with gemini-embedding-2 over a4i_food.recipient_embeddings.
2. Lexical BM25 Search: Token-level inverted index scoring with rank-bm25 over a4i_food.recipient_embeddings.tokens.
3. Reciprocal Rank Fusion (RRF): Blends dense and lexical rankings using RRF(d) = sum(1 / (k + rank)).
4. Vertex AI Cross-Encoder Reranker: Calls Discovery Engine semantic-ranker-default for fine-grained relevance.
5. Hard Operational Post-Filtering: Partitions near-miss decoys (cold-chain, capacity, clock, contradiction).
6. Demographic Equity Tie-Breaking: Uses US Census ACS tract poverty and no-vehicle rates from a4i_food.tract_demographics.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Optional

import requests
import google.auth
from google.auth.transport.requests import Request
from google.cloud import bigquery
from rank_bm25 import BM25Okapi

from .config import (
    ATLANTA_METRO_BASELINE,
    BQ_DATASET,
    EMBED_ENDPOINT,
    GOOGLE_CLOUD_PROJECT,
)
from .tools import _detect_planted_role, _tract_neighborhood_label

logger = logging.getLogger(__name__)

# Constants
RRF_K: int = 60
DEFAULT_TOP_K_RETRIEVAL: int = 50
DEFAULT_TOP_K_RRF: int = 35
DEFAULT_TOP_K_RERANK: int = 30

CONTRADICTION_PHRASES = (
    "no refrigeration of any kind",
    "dry storage only",
    "no freezer at present",
    "single shelf in a shared cupboard",
    "single hallway cupboard shelf",
    "cannot take anything that needs a fridge or freezer",
)


def _tokenize(text: str) -> list[str]:
    """Tokenize text into lowercase alphanumeric words."""
    if not text:
        return []
    return re.findall(r"\b[a-zA-Z0-9_\-\.]{2,}\b", text.lower())


class HybridSearchEngine:
    """Enterprise Hybrid Search Engine connecting BigQuery Vector Search, BM25, and Vertex AI."""

    def __init__(
        self,
        project_id: str = GOOGLE_CLOUD_PROJECT,
        dataset_id: str = BQ_DATASET,
    ):
        self.project_id = project_id
        self.dataset_id = dataset_id
        self._bq_client: Optional[bigquery.Client] = None
        self._credentials = None

        # Corpus cache
        self._corpus_loaded = False
        self._recipients: list[dict[str, Any]] = []
        self._recipient_lookup: dict[int, dict[str, Any]] = {}
        self._bm25_model: Optional[BM25Okapi] = None
        self._posting_embeddings: dict[int, list[float]] = {}
        self._posting_summaries: dict[int, str] = {}
        self._posting_tokens: dict[int, list[str]] = {}

    def _get_bq_client(self) -> bigquery.Client:
        if self._bq_client is None:
            self._bq_client = bigquery.Client(project=self.project_id)
        return self._bq_client

    def _get_auth_token(self) -> str:
        if self._credentials is None:
            self._credentials, _ = google.auth.default()
        if not self._credentials.valid:
            self._credentials.refresh(Request())
        return self._credentials.token

    def load_corpus(self, force_reload: bool = False) -> None:
        """Load and cache the 127 recipients with embeddings, tokens, and Census demographics."""
        if self._corpus_loaded and not force_reload:
            return

        client = self._get_bq_client()
        logger.info("Loading recipient corpus from %s.%s...", self.project_id, self.dataset_id)

        # 1. Fetch 127 recipients joined with embeddings and tract demographics
        query = f"""
        SELECT
            r.recipient_id,
            r.ein,
            r.name,
            r.street,
            r.city,
            r.state,
            r.zip_code,
            r.ntee_code,
            r.archetype,
            r.archetype_label,
            r.cold_storage,
            r.frozen_storage,
            r.loading_dock,
            r.refrigerated_transport,
            r.max_pallets,
            r.pickup_window_hours,
            r.weekly_households,
            r.reported_income,
            r.populations_served,
            r.service_days,
            r.profile_text,
            r.profile_source,
            r.latitude,
            r.longitude,
            e.summary,
            e.tokens,
            d.tract_geo_id,
            d.distance_to_tract_miles,
            d.total_pop,
            d.median_income,
            d.poverty_rate,
            d.no_vehicle_rate,
            d.assistance_rate
        FROM `{self.project_id}.{self.dataset_id}.recipients` r
        INNER JOIN `{self.project_id}.{self.dataset_id}.recipient_embeddings` e
            USING (recipient_id)
        LEFT JOIN `{self.project_id}.{self.dataset_id}.recipients_demographics` d
            USING (recipient_id)
        ORDER BY r.recipient_id
        """

        rows = list(client.query(query))
        recipients_list = []
        corpus_tokens = []

        for row in rows:
            rid = int(row.recipient_id)
            tokens = list(row.tokens or [])
            if not tokens:
                tokens = _tokenize(f"{row.summary or ''} {row.profile_text or ''}")

            gid = str(row.tract_geo_id or "13121005700")
            tract_obj = {
                "geo_id": gid,
                "neighborhood": _tract_neighborhood_label(gid, str(row.city or "Atlanta"), str(row.zip_code or "")),
                "tract_lat": float(row.latitude or 33.75),
                "tract_lon": float(row.longitude or -84.39),
                "total_pop": int(row.total_pop or 3200),
                "median_income": float(row.median_income or 42000.0),
                "poverty_rate": round(float(row.poverty_rate or 0.188), 4),
                "no_vehicle_rate": round(float(row.no_vehicle_rate or 0.128), 4),
                "assistance_rate": round(float(row.assistance_rate or 0.180), 4),
            }
            planted_role = _detect_planted_role(
                rid, str(row.profile_source or "generated"), str(row.profile_text or "")
            )

            item = {
                "recipient_id": rid,
                "ein": str(row.ein or ""),
                "name": str(row.name or f"Recipient {rid}"),
                "street": str(row.street or ""),
                "city": str(row.city or "Atlanta"),
                "state": str(row.state or "GA"),
                "zip_code": str(row.zip_code or ""),
                "ntee_code": str(row.ntee_code or ""),
                "archetype": str(row.archetype or ""),
                "archetype_label": str(row.archetype_label or ""),
                "cold_storage": str(row.cold_storage or "none"),
                "frozen_storage": bool(row.frozen_storage),
                "loading_dock": bool(row.loading_dock),
                "refrigerated_transport": bool(row.refrigerated_transport),
                "max_pallets": int(row.max_pallets or 0),
                "pickup_window_hours": int(row.pickup_window_hours or 4),
                "weekly_households": int(row.weekly_households or 100),
                "reported_income": float(row.reported_income or 0.0),
                "populations_served": str(row.populations_served or "general"),
                "service_days": str(row.service_days or "Mon-Fri"),
                "profile_text": str(row.profile_text or ""),
                "profile_source": str(row.profile_source or "generated"),
                "planted_role": planted_role,
                "latitude": float(row.latitude or 33.75),
                "longitude": float(row.longitude or -84.39),
                "summary": str(row.summary or row.profile_text or ""),
                "tokens": tokens,
                "tract_geo_id": gid,
                "geo_id": gid,
                "tract": tract_obj,
                "distance_to_tract_miles": float(row.distance_to_tract_miles or 0.0),
                "total_pop": tract_obj["total_pop"],
                "median_income": tract_obj["median_income"],
                "poverty_rate": tract_obj["poverty_rate"],
                "no_vehicle_rate": tract_obj["no_vehicle_rate"],
                "assistance_rate": tract_obj["assistance_rate"],
            }
            recipients_list.append(item)
            self._recipient_lookup[rid] = item
            corpus_tokens.append(tokens)

        self._recipients = recipients_list
        self._bm25_model = BM25Okapi(corpus_tokens)

        # 2. Fetch posting embeddings for fast lookup
        postings_q = f"""
        SELECT posting_id, summary, tokens, embedding
        FROM `{self.project_id}.{self.dataset_id}.posting_embeddings`
        ORDER BY posting_id
        """
        for prow in client.query(postings_q):
            pid = int(prow.posting_id)
            self._posting_embeddings[pid] = [float(x) for x in prow.embedding]
            self._posting_summaries[pid] = str(prow.summary or "")
            self._posting_tokens[pid] = list(prow.tokens or [])

        self._corpus_loaded = True
        logger.info(
            "Corpus loaded successfully: %d recipients indexed in BM25, %d postings cached",
            len(self._recipients),
            len(self._posting_embeddings),
        )

    def dense_vector_search(
        self,
        query_text: Optional[str] = None,
        posting_id: Optional[int] = None,
        top_k: int = DEFAULT_TOP_K_RETRIEVAL,
    ) -> list[dict[str, Any]]:
        """Execute BigQuery VECTOR_SEARCH with gemini-embedding-2."""
        self.load_corpus()
        client = self._get_bq_client()

        if posting_id is not None and posting_id in self._posting_embeddings:
            # Query directly using posting_embeddings vector
            query = f"""
            SELECT
              base.recipient_id,
              ROUND(1.0 - distance, 4) AS cosine_similarity,
              ROUND(distance, 4) AS cosine_distance
            FROM VECTOR_SEARCH(
              TABLE `{self.project_id}.{self.dataset_id}.recipient_embeddings`,
              'embedding',
              (
                SELECT embedding
                FROM `{self.project_id}.{self.dataset_id}.posting_embeddings`
                WHERE posting_id = @posting_id
              ),
              top_k => @top_k,
              distance_type => 'COSINE',
              options => '{{"use_brute_force":true}}'
            )
            ORDER BY cosine_similarity DESC
            """
            job_config = bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("posting_id", "INT64", posting_id),
                    bigquery.ScalarQueryParameter("top_k", "INT64", top_k),
                ]
            )
        else:
            # Embed on-the-fly via AI.EMBED
            query = f"""
            SELECT
              base.recipient_id,
              ROUND(1.0 - distance, 4) AS cosine_similarity,
              ROUND(distance, 4) AS cosine_distance
            FROM VECTOR_SEARCH(
              TABLE `{self.project_id}.{self.dataset_id}.recipient_embeddings`,
              'embedding',
              (
                SELECT
                  AI.EMBED(
                    @query_text,
                    connection_id => 'us.vertex_ai',
                    endpoint => '{EMBED_ENDPOINT}'
                  ).result AS embedding
              ),
              top_k => @top_k,
              distance_type => 'COSINE',
              options => '{{"use_brute_force":true}}'
            )
            ORDER BY cosine_similarity DESC
            """
            job_config = bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("query_text", "STRING", query_text or ""),
                    bigquery.ScalarQueryParameter("top_k", "INT64", top_k),
                ]
            )

        rows = list(client.query(query, job_config=job_config))
        results = []
        for rank, row in enumerate(rows, 1):
            rid = int(row.recipient_id)
            results.append(
                {
                    "recipient_id": rid,
                    "cosine_similarity": float(row.cosine_similarity),
                    "cosine_distance": float(row.cosine_distance),
                    "vector_rank": rank,
                }
            )
        return results

    def lexical_bm25_search(
        self,
        query_text: Optional[str] = None,
        posting_id: Optional[int] = None,
        top_k: int = DEFAULT_TOP_K_RETRIEVAL,
    ) -> list[dict[str, Any]]:
        """Execute Lexical BM25 search over deduplicated tokens."""
        self.load_corpus()

        if posting_id is not None and posting_id in self._posting_tokens:
            q_tokens = self._posting_tokens[posting_id]
        else:
            q_tokens = _tokenize(query_text or "")

        if not q_tokens or self._bm25_model is None:
            return []

        scores = self._bm25_model.get_scores(q_tokens)
        scored_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)

        results = []
        for rank, idx in enumerate(scored_indices[:top_k], 1):
            recipient = self._recipients[idx]
            results.append(
                {
                    "recipient_id": recipient["recipient_id"],
                    "bm25_score": round(float(scores[idx]), 4),
                    "bm25_rank": rank,
                }
            )
        return results

    def reciprocal_rank_fusion(
        self,
        vector_results: list[dict[str, Any]],
        bm25_results: list[dict[str, Any]],
        k: int = RRF_K,
        top_k: int = DEFAULT_TOP_K_RRF,
    ) -> list[dict[str, Any]]:
        """Combine dense and lexical results using Reciprocal Rank Fusion (RRF)."""
        rrf_scores: dict[int, float] = {}
        vec_rank_map: dict[int, int] = {r["recipient_id"]: r["vector_rank"] for r in vector_results}
        bm25_rank_map: dict[int, int] = {r["recipient_id"]: r["bm25_rank"] for r in bm25_results}
        vec_sim_map: dict[int, float] = {r["recipient_id"]: r["cosine_similarity"] for r in vector_results}
        bm25_score_map: dict[int, float] = {r["recipient_id"]: r["bm25_score"] for r in bm25_results}

        all_ids = set(vec_rank_map.keys()).union(set(bm25_rank_map.keys()))

        for rid in all_ids:
            score = 0.0
            if rid in vec_rank_map:
                score += 1.0 / (k + vec_rank_map[rid])
            else:
                score += 1.0 / (k + 100)  # Missing rank penalty

            if rid in bm25_rank_map:
                score += 1.0 / (k + bm25_rank_map[rid])
            else:
                score += 1.0 / (k + 100)  # Missing rank penalty

            rrf_scores[rid] = score

        sorted_ids = sorted(all_ids, key=lambda rid: rrf_scores[rid], reverse=True)[:top_k]

        fused = []
        for rank, rid in enumerate(sorted_ids, 1):
            fused.append(
                {
                    "recipient_id": rid,
                    "rrf_score": round(rrf_scores[rid], 5),
                    "rrf_rank": rank,
                    "vector_rank": vec_rank_map.get(rid),
                    "bm25_rank": bm25_rank_map.get(rid),
                    "cosine_similarity": vec_sim_map.get(rid, 0.0),
                    "bm25_score": bm25_score_map.get(rid, 0.0),
                }
            )
        return fused

    def vertex_ai_rerank(
        self,
        query_text: str,
        candidates: list[dict[str, Any]],
        top_k: int = DEFAULT_TOP_K_RERANK,
    ) -> list[dict[str, Any]]:
        """Call Vertex AI Discovery Engine Ranking API (semantic-ranker-default) with fallback."""
        if not candidates:
            return []

        token = self._get_auth_token()
        url = (
            f"https://discoveryengine.googleapis.com/v1alpha/projects/{self.project_id}"
            "/locations/global/rankingConfigs/default_ranking_config:rank"
        )
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "X-Goog-User-Project": self.project_id,
        }

        # Build payload of records to rerank
        records_payload = []
        for c in candidates:
            rid = c["recipient_id"]
            rec_meta = self._recipient_lookup.get(rid, {})
            # Use candidate summary + profile text for cross-encoder attention
            content = rec_meta.get("summary") or rec_meta.get("profile_text", "")
            records_payload.append(
                {
                    "id": str(rid),
                    "content": content[:1200],
                }
            )

        payload = {
            "model": "semantic-ranker-default",
            "query": query_text,
            "records": records_payload,
            "top_n": top_k,
        }

        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=10.0)
            if resp.status_code == 200:
                ranker_data = resp.json().get("records", [])
                score_map = {int(r["id"]): float(r["score"]) for r in ranker_data}
                reranked = []
                # Sort according to ranker order
                for rank, r in enumerate(ranker_data, 1):
                    rid = int(r["id"])
                    base_cand = next((c for c in candidates if c["recipient_id"] == rid), {})
                    reranked.append(
                        {
                            **base_cand,
                            "recipient_id": rid,
                            "reranker_score": round(float(r["score"]), 4),
                            "reranker_rank": rank,
                            "rerank_source": "vertex_ai_semantic_ranker",
                        }
                    )
                return reranked
            else:
                logger.warning(
                    "Vertex AI Ranker returned HTTP %d: %s. Using RRF fallback.",
                    resp.status_code,
                    resp.text,
                )
        except Exception as exc:
            logger.warning("Vertex AI Ranker request failed (%s). Using RRF fallback.", exc)

        # Fallback to normalized RRF score
        fallback = []
        for rank, c in enumerate(candidates[:top_k], 1):
            fallback.append(
                {
                    **c,
                    "reranker_score": round(c.get("rrf_score", 0.0) * 10.0, 4),
                    "reranker_rank": rank,
                    "rerank_source": "rrf_fallback",
                }
            )
        return fallback

    def filter_and_partition_decoys(
        self,
        candidates: list[dict[str, Any]],
        required_storage: str = "refrigerated",
        pallets_needed: float = 1.5,
        hours_remaining: float = 6.0,
        excluded_recipient_ids: Optional[set[int]] = None,
        is_clinical: bool = False,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Apply hard operational verification and isolate near-miss decoys."""
        excluded = excluded_recipient_ids or set()
        viable: list[dict[str, Any]] = []
        decoys: list[dict[str, Any]] = []

        req_storage = (required_storage or "pantry").lower()

        for cand in candidates:
            rid = cand["recipient_id"]
            rec = self._recipient_lookup.get(rid, {})
            cold_storage = rec.get("cold_storage", "none").lower()
            frozen_storage = rec.get("frozen_storage", False)
            max_pallets = rec.get("max_pallets", 0)
            pickup_window = rec.get("pickup_window_hours", 4)
            reefer_transport = rec.get("refrigerated_transport", False)
            profile_text = rec.get("profile_text", "")
            profile_lower = profile_text.lower()

            reasons: list[str] = []

            # 1. Manual Coordinator Exclusion
            if rid in excluded:
                reasons.append("Coordinator manual exclusion ('They said no').")

            # 2. Planted Profile Contradiction (e.g. Harborview #120)
            has_contradiction = any(phrase in profile_lower for phrase in CONTRADICTION_PHRASES)
            if has_contradiction and (cold_storage != "none" or max_pallets > 1 or frozen_storage):
                reasons.append(
                    f"Profile Contradiction Block: Structured schema states cold_storage='{cold_storage}', "
                    f"max_pallets={max_pallets}, but profile text states: '{profile_text}'"
                )

            # 3. Hard Cold-Chain Storage Constraint (e.g. Greenline #119)
            if req_storage == "refrigerated":
                if cold_storage == "none" or "no refrigeration of any kind" in profile_lower:
                    reasons.append(
                        f"Cold-Chain Safety Block: Surplus requires '{req_storage}' storage within {hours_remaining:.0f}h, "
                        f"but recipient has cold_storage='none' (dry ambient storage only)."
                    )
            elif req_storage == "frozen":
                if not frozen_storage or "no freezer at present" in profile_lower:
                    reasons.append("Frozen-Chain Safety Block: Surplus requires freezer, recipient lacks freezer.")

            # 4. Clinical Storage Custody (Posting #10)
            if is_clinical and cold_storage != "medical":
                reasons.append(
                    f"Clinical Custody Block: Requires certified medical cold storage ('medical'), found '{cold_storage}'."
                )

            # 5. Pallet Capacity Filter
            if max_pallets < pallets_needed:
                reasons.append(
                    f"Pallet Capacity Block: Offer is {pallets_needed:.1f} pallets, recipient max_pallets={max_pallets}."
                )

            # 6. Spoilage Clock / Pickup Window
            effective_window_limit = max(hours_remaining * 2.0, 14.0)
            if pickup_window > effective_window_limit and not reefer_transport and rec.get("archetype") != "community_clinic":
                reasons.append(
                    f"Clock Window Missed: Lead time is {pickup_window}h without reefer transport, exceeding clock ({hours_remaining:.0f}h)."
                )

            # Demographic Equity Context
            pov_rate = rec.get("poverty_rate", 0.188)
            no_veh_rate = rec.get("no_vehicle_rate", 0.128)
            asst_rate = rec.get("assistance_rate", 0.180)
            equity_score = round((no_veh_rate * 0.45) + (pov_rate * 0.35) + (asst_rate * 0.20), 4)

            enriched_cand = {
                **cand,
                **rec,
                "equity_score": equity_score,
                "clock_margin_hours": max(0.0, round(hours_remaining - min(float(pickup_window), 2.5), 1)),
            }

            if reasons:
                enriched_cand["rejection_reasons"] = reasons
                decoys.append(enriched_cand)
            else:
                viable.append(enriched_cand)

        return viable, decoys

    def apply_demographic_equity_ranking(
        self,
        viable_candidates: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Combine Vertex AI Reranker score (70%) with Census tract equity score (30%) and break ties."""
        ranked: list[dict[str, Any]] = []

        for cand in viable_candidates:
            rerank_score = cand.get("reranker_score", 0.1)
            # Normalize reranker score into [0..1] range if needed
            norm_rerank = min(1.0, max(0.0, rerank_score * 2.2))
            equity_score = cand.get("equity_score", 0.2)

            composite_score = round((norm_rerank * 0.70) + (equity_score * 0.30), 4)
            cand_copy = {
                **cand,
                "semantic_similarity": round(norm_rerank, 4),
                "normalized_rerank_score": round(norm_rerank, 4),
                "composite_score": composite_score,
            }
            ranked.append(cand_copy)

        # Sort by composite_score DESC, breaking ties on no_vehicle_rate DESC, then poverty_rate DESC
        ranked.sort(
            key=lambda c: (
                c["composite_score"],
                c.get("no_vehicle_rate", 0.0),
                c.get("poverty_rate", 0.0),
            ),
            reverse=True,
        )

        for final_rank, c in enumerate(ranked, 1):
            c["final_rank"] = final_rank

        return ranked

    def match_surplus_posting(
        self,
        posting_id: Optional[int] = None,
        query_text: Optional[str] = None,
        storage_state: str = "refrigerated",
        pallets_needed: float = 1.5,
        hours_remaining: float = 6.0,
        excluded_recipient_ids: Optional[list[int]] = None,
    ) -> dict[str, Any]:
        """End-to-End Orchestration: Vector Search -> BM25 -> RRF -> Vertex AI -> Filter/Decoys -> Equity."""
        self.load_corpus()

        # Resolve query text
        if posting_id is not None and posting_id in self._posting_summaries:
            effective_query_text = self._posting_summaries[posting_id]
        else:
            effective_query_text = query_text or "surplus food produce cold storage"

        is_clinical = "clinic" in effective_query_text.lower() or "medical" in effective_query_text.lower()

        # Step 1: Dense Vector Search
        vector_candidates = self.dense_vector_search(
            query_text=effective_query_text,
            posting_id=posting_id,
            top_k=DEFAULT_TOP_K_RETRIEVAL,
        )

        # Step 2: Lexical BM25 Search
        bm25_candidates = self.lexical_bm25_search(
            query_text=effective_query_text,
            posting_id=posting_id,
            top_k=DEFAULT_TOP_K_RETRIEVAL,
        )

        # Step 3: Reciprocal Rank Fusion (RRF)
        fused_candidates = self.reciprocal_rank_fusion(
            vector_results=vector_candidates,
            bm25_results=bm25_candidates,
            k=RRF_K,
            top_k=DEFAULT_TOP_K_RRF,
        )

        # Step 4: Vertex AI Cross-Encoder Reranker
        reranked_candidates = self.vertex_ai_rerank(
            query_text=effective_query_text,
            candidates=fused_candidates,
            top_k=DEFAULT_TOP_K_RERANK,
        )

        # Step 5: Post-filtering and Decoy Partitioning
        viable_raw, decoys = self.filter_and_partition_decoys(
            candidates=reranked_candidates,
            required_storage=storage_state,
            pallets_needed=pallets_needed,
            hours_remaining=hours_remaining,
            excluded_recipient_ids=set(excluded_recipient_ids or []),
            is_clinical=is_clinical,
        )

        # Step 6: Demographic Equity Tie-Breaking & Final Ranking
        viable_ranked = self.apply_demographic_equity_ranking(viable_raw)

        return {
            "query_metadata": {
                "posting_id": posting_id,
                "query_text": effective_query_text,
                "storage_state": storage_state,
                "pallets_needed": pallets_needed,
                "hours_remaining": hours_remaining,
                "excluded_recipients": list(excluded_recipient_ids or []),
            },
            "vector_top_5": vector_candidates[:5],
            "bm25_top_5": bm25_candidates[:5],
            "rrf_top_5": fused_candidates[:5],
            "reranked_top_5": reranked_candidates[:5],
            "viable_candidates": viable_ranked,
            "flagged_decoys": decoys,
            "total_viable_count": len(viable_ranked),
            "total_decoy_count": len(decoys),
        }


# Global singleton engine instance
_ENGINE_INSTANCE: Optional[HybridSearchEngine] = None


def get_search_engine() -> HybridSearchEngine:
    global _ENGINE_INSTANCE
    if _ENGINE_INSTANCE is None:
        _ENGINE_INSTANCE = HybridSearchEngine()
    return _ENGINE_INSTANCE
