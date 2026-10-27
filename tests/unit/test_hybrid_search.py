"""Unit tests for ATL-07 Hybrid Vector & Lexical Search Engine."""

import pytest
from agent.atl_broker.vector_search import get_search_engine, RRF_K


@pytest.fixture(scope="module")
def search_engine():
    engine = get_search_engine()
    engine.load_corpus()
    return engine


def test_corpus_loaded(search_engine):
    assert len(search_engine._recipients) == 127
    assert search_engine._bm25_model is not None
    assert len(search_engine._posting_embeddings) == 10


def test_reciprocal_rank_fusion_math(search_engine):
    vec_results = [
        {"recipient_id": 101, "vector_rank": 1, "cosine_similarity": 0.90},
        {"recipient_id": 102, "vector_rank": 2, "cosine_similarity": 0.85},
    ]
    bm25_results = [
        {"recipient_id": 102, "bm25_rank": 1, "bm25_score": 15.0},
        {"recipient_id": 101, "bm25_rank": 2, "bm25_score": 12.0},
    ]
    fused = search_engine.reciprocal_rank_fusion(vec_results, bm25_results, k=60, top_k=2)

    assert len(fused) == 2
    # Both 101 and 102 have 1/(60+1) + 1/(60+2)
    expected_score = round((1.0 / 61) + (1.0 / 62), 5)
    assert fused[0]["rrf_score"] == expected_score
    assert fused[1]["rrf_score"] == expected_score


def test_greenline_decoy_blocked_on_refrigerated(search_engine):
    """Greenline Community Pantry (recipient_id=119) has cold_storage='none'."""
    res = search_engine.match_surplus_posting(
        posting_id=1,
        storage_state="refrigerated",
        pallets_needed=1.5,
        hours_remaining=6.0,
    )
    # 119 must NOT be in viable candidates
    viable_ids = [v["recipient_id"] for v in res["viable_candidates"]]
    assert 119 not in viable_ids

    # 119 must be in flagged decoys with a cold-chain reason
    decoy_119 = next((d for d in res["flagged_decoys"] if d["recipient_id"] == 119), None)
    assert decoy_119 is not None
    reasons = " ".join(decoy_119["rejection_reasons"]).lower()
    assert "cold-chain safety block" in reasons or "cold_storage='none'" in reasons


def test_harborview_contradiction_blocked(search_engine):
    """Harborview Neighbors Trust (recipient_id=120) has a planted profile contradiction."""
    candidates = [
        {"recipient_id": 120, "rrf_score": 0.03, "reranker_score": 0.45}
    ]
    viable, decoys = search_engine.filter_and_partition_decoys(
        candidates=candidates,
        required_storage="frozen",
        pallets_needed=2.0,
        hours_remaining=12.0,
    )
    assert len(viable) == 0
    assert len(decoys) == 1
    reasons = " ".join(decoys[0]["rejection_reasons"]).lower()
    assert "contradiction" in reasons


def test_equity_tie_breaking(search_engine):
    """Maple Street (#122) and Cedar Street (#121) produce alliance tie breaking."""
    candidates = [
        {
            "recipient_id": 121,
            "name": "Cedar Street Produce Alliance",
            "reranker_score": 0.40,
            "cold_storage": "walk-in",
            "max_pallets": 10,
            "pickup_window_hours": 12,
            "refrigerated_transport": True,
            "poverty_rate": 0.2138,
            "no_vehicle_rate": 0.2575,
            "assistance_rate": 0.267,
        },
        {
            "recipient_id": 122,
            "name": "Maple Street Produce Alliance",
            "reranker_score": 0.40,
            "cold_storage": "walk-in",
            "max_pallets": 10,
            "pickup_window_hours": 12,
            "refrigerated_transport": True,
            "poverty_rate": 0.3322,
            "no_vehicle_rate": 0.2516,
            "assistance_rate": 0.300,
        },
    ]
    viable, _ = search_engine.filter_and_partition_decoys(
        candidates=candidates,
        required_storage="refrigerated",
        pallets_needed=1.5,
        hours_remaining=6.0,
    )
    ranked = search_engine.apply_demographic_equity_ranking(viable)
    assert len(ranked) == 2
    # Maple Street (#122) has 33.2% poverty rate vs Cedar Street (#121) 21.4%
    assert ranked[0]["recipient_id"] == 122
    assert ranked[1]["recipient_id"] == 121
