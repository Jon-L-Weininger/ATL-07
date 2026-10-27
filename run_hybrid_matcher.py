#!/usr/bin/env python3
"""Local Runner for ATL-07 Hybrid Vector & Lexical Search Engine.

Demonstrates the 6-stage Hybrid Pipeline:
  Stage 1: BigQuery Dense Vector Search (VECTOR_SEARCH + gemini-embedding-2)
  Stage 2: Lexical BM25 Search (rank-bm25 over deduplicated tokens)
  Stage 3: Reciprocal Rank Fusion (RRF with k=60)
  Stage 4: Vertex AI Cross-Encoder Reranker (Discovery Engine semantic-ranker-default)
  Stage 5: Hard Operational Post-Filtering & Decoy Partitioning
  Stage 6: Census Tract Equity Tie-Breaking & Final Viable Ranking

Usage:
  python run_hybrid_matcher.py --posting 1
  python run_hybrid_matcher.py --posting 5
  python run_hybrid_matcher.py --all
"""

from __future__ import annotations

import argparse
import sys
import time

from agent.atl_broker.config import ATLANTA_METRO_BASELINE
from agent.atl_broker.tools import get_active_postings, lookup_shelf_life_clock
from agent.atl_broker.vector_search import get_search_engine


def print_banner(text: str, char: str = "=", width: int = 80) -> None:
    print(f"\n{char * width}")
    print(f" {text.center(width - 2)} ")
    print(f"{char * width}")


def format_percent(val: float) -> str:
    return f"{val * 100:.1f}%"


def run_posting_match(posting_id: int) -> None:
    engine = get_search_engine()
    postings = get_active_postings()
    posting = next((p for p in postings if p["posting_id"] == posting_id), None)
    if not posting:
        print(f"Error: Posting #{posting_id} not found in BigQuery corpus.")
        return

    clock = lookup_shelf_life_clock(
        product_query=posting["foodkeeper_product"],
        storage_state=posting["storage_state"],
        donor_hours=posting["hours_available"],
    )

    donor_name = posting.get("donor_name", f"Atlanta Partner Donor #{posting_id}")
    pallets = posting.get("pallets_estimated", 1.5)
    clock_hours = clock["hours_remaining"]

    print_banner(f"ATL-07 SURPLUS MATCHING: POSTING #{posting_id} [{posting['track']}]")
    print(f"Donor Name       : {donor_name}")
    print(f"Item / Product   : {posting['foodkeeper_product']}")
    print(f"Surplus Offer    : \"{posting['posting_text']}\"")
    print(f"Storage State    : {posting['storage_state'].upper()}")
    print(f"Load Volume      : ~{pallets:.1f} Pallets")
    print(f"Spoilage Clock   : {clock_hours:.1f} Hours remaining ({clock['governing_constraint'].replace('_', ' ')})")
    print(f"FoodKeeper Note  : {clock['foodkeeper_note']}")

    t0 = time.time()
    res = engine.match_surplus_posting(
        posting_id=posting_id,
        storage_state=posting["storage_state"],
        pallets_needed=pallets,
        hours_remaining=clock_hours,
    )
    elapsed = time.time() - t0

    # STAGE 1: DENSE VECTOR SEARCH
    print("\n" + "-" * 80)
    print("STAGE 1: Dense Vector Search (BigQuery VECTOR_SEARCH + gemini-embedding-2)")
    print("-" * 80)
    print(f"{'Rank':<5} {'ID':<6} {'Similarity':<12} {'Distance':<10} {'Recipient Name':<35}")
    print("-" * 80)
    for r in res["vector_top_5"]:
        rid = r["recipient_id"]
        rec = engine._recipient_lookup.get(rid, {})
        print(f"#{r['vector_rank']:<4} {rid:<6} {r['cosine_similarity']:<12.4f} {r['cosine_distance']:<10.4f} {rec.get('name', 'N/A')[:34]:<35}")

    # STAGE 2: LEXICAL BM25 SEARCH
    print("\n" + "-" * 80)
    print("STAGE 2: Lexical BM25 Search (rank-bm25 over deduplicated summary & metadata tokens)")
    print("-" * 80)
    print(f"{'Rank':<5} {'ID':<6} {'BM25 Score':<12} {'Recipient Name':<35} {'Archetype':<20}")
    print("-" * 80)
    for r in res["bm25_top_5"]:
        rid = r["recipient_id"]
        rec = engine._recipient_lookup.get(rid, {})
        print(f"#{r['bm25_rank']:<4} {rid:<6} {r['bm25_score']:<12.4f} {rec.get('name', 'N/A')[:34]:<35} {rec.get('archetype', 'N/A'):<20}")

    # STAGE 3: RECIPROCAL RANK FUSION (RRF)
    print("\n" + "-" * 80)
    print("STAGE 3: Reciprocal Rank Fusion [RRF = 1/(60+VecRank) + 1/(60+BM25Rank)]")
    print("-" * 80)
    print(f"{'Rank':<5} {'ID':<6} {'RRF Score':<12} {'Vec Rank':<10} {'BM25 Rank':<10} {'Recipient Name':<35}")
    print("-" * 80)
    for r in res["rrf_top_5"]:
        rid = r["recipient_id"]
        rec = engine._recipient_lookup.get(rid, {})
        vr = f"#{r['vector_rank']}" if r.get("vector_rank") else "N/A"
        br = f"#{r['bm25_rank']}" if r.get("bm25_rank") else "N/A"
        print(f"#{r['rrf_rank']:<4} {rid:<6} {r['rrf_score']:<12.5f} {vr:<10} {br:<10} {rec.get('name', 'N/A')[:34]:<35}")

    # STAGE 4: VERTEX AI CROSS-ENCODER RERANKER
    print("\n" + "-" * 80)
    print(f"STAGE 4: Vertex AI Semantic Reranker (Discovery Engine 'semantic-ranker-default')")
    print("-" * 80)
    print(f"{'Rank':<5} {'ID':<6} {'Cross-Encoder Score':<22} {'Engine Source':<28} {'Recipient Name':<25}")
    print("-" * 80)
    for r in res["reranked_top_5"]:
        rid = r["recipient_id"]
        rec = engine._recipient_lookup.get(rid, {})
        source = r.get("rerank_source", "vertex_ai")
        print(f"#{r['reranker_rank']:<4} {rid:<6} {r['reranker_score']:<22.4f} {source:<28} {rec.get('name', 'N/A')[:24]:<25}")

    # STAGE 5: HARD OPERATIONAL POST-FILTERING & DECOY PARTITIONS
    print("\n" + "-" * 80)
    print(f"STAGE 5: Hard Operational Post-Filtering & Decoy Partitioning ({len(res['flagged_decoys'])} Blocked)")
    print("-" * 80)
    if res["flagged_decoys"]:
        for d in res["flagged_decoys"][:4]:
            print(f"  [X] BLOCKED: ID {d['recipient_id']} - {d['name']}")
            print(f"      Storage: {d['cold_storage']} | Max Pallets: {d['max_pallets']} | Pickup: {d['pickup_window_hours']}h")
            for reason in d["rejection_reasons"]:
                print(f"      -> {reason}")
    else:
        print("  None: All evaluated candidates met operational criteria.")

    # STAGE 6: DEMOGRAPHIC EQUITY TIE-BREAKING & FINAL VIABLE RANKING
    print("\n" + "-" * 80)
    print(f"STAGE 6: Demographic Equity Tie-Breaking & Final Qualified Matches ({len(res['viable_candidates'])} Viable)")
    print("-" * 80)
    print(f"{'Final':<6} {'ID':<5} {'Composite':<10} {'Equity':<8} {'Poverty':<9} {'No-Veh':<8} {'MaxPlt':<7} {'Recipient Name':<26}")
    print("-" * 80)
    for v in res["viable_candidates"][:4]:
        tract = v.get("tract", {})
        print(
            f"#{v['final_rank']:<5} "
            f"{v['recipient_id']:<5} "
            f"{v['composite_score']:<10.4f} "
            f"{v['equity_score']:<8.4f} "
            f"{format_percent(v['poverty_rate']):<9} "
            f"{format_percent(v['no_vehicle_rate']):<8} "
            f"{v['max_pallets']:<7} "
            f"{v['name'][:25]:<26}"
        )

    # DETAILED PRIMARY MATCH BRIEF
    if res["viable_candidates"]:
        primary = res["viable_candidates"][0]
        tract = primary.get("tract", {})
        print_banner(f"PRIMARY DISPATCH RECOMMENDATION: {primary['name']} (ID: {primary['recipient_id']})", char="*")
        print(f"Address          : {primary['street']}, {primary['city']}, {primary['state']} {primary['zip_code']}")
        print(f"Archetype        : {primary.get('archetype_label', primary.get('archetype'))}")
        print(f"Service Days     : {primary['service_days']} (Serving ~{primary['weekly_households']} weekly households)")
        print(f"Operational Spec : Cold Storage: '{primary['cold_storage']}' | Capacity: {primary['max_pallets']} Pallets")
        print(f"Transport/Intake : {'On-site Refrigerated Transport' if primary['refrigerated_transport'] else f'{primary['pickup_window_hours']}h dock window'}")
        print(f"Census Tract     : Tract {tract.get('geo_id', 'N/A')} - {tract.get('neighborhood', 'Atlanta')}")
        print(f"Equity Metrics   : Poverty: {format_percent(tract.get('poverty_rate', 0))} (Metro avg: {format_percent(ATLANTA_METRO_BASELINE['poverty_rate'])})")
        print(f"                   No-Vehicle: {format_percent(tract.get('no_vehicle_rate', 0))} (Metro avg: {format_percent(ATLANTA_METRO_BASELINE['no_vehicle_rate'])})")
        print(f"Clock Safety     : {clock_hours:.1f}h clock - {min(primary['pickup_window_hours'], 2.5):.1f}h lead time = {primary['clock_margin_hours']:.1f}h safety margin")

        # Check tie-breaker with #2
        if len(res["viable_candidates"]) > 1:
            runner_up = res["viable_candidates"][1]
            if runner_up["recipient_id"] in (121, 122) and primary["recipient_id"] in (121, 122):
                print("\n  [EQUITY TIE-BREAKER HIGHLIGHT]")
                print(f"  Tied closely on semantic similarity and capacity with {runner_up['name']} (ID {runner_up['recipient_id']}).")
                print(f"  Tie broken in favor of {primary['name']} due to Census Tract need:")
                print(f"    - {primary['name']} Tract {tract.get('geo_id')}: Poverty {format_percent(primary['poverty_rate'])}, Transit Desert {format_percent(primary['no_vehicle_rate'])}")
                print(f"    - {runner_up['name']} Tract {runner_up['tract']['geo_id']}: Poverty {format_percent(runner_up['poverty_rate'])}, Transit Desert {format_percent(runner_up['no_vehicle_rate'])}")

        # Pallet split schedule if pallets_needed > primary max_pallets
        if pallets > primary["max_pallets"]:
            print("\n  [LOAD-SPLITTING SCHEDULE REQUIRED]")
            print(f"  Offer is {pallets:.1f} pallets, exceeding primary capacity of {primary['max_pallets']} pallets.")
            rem = pallets
            for idx, c in enumerate(res["viable_candidates"]):
                if rem <= 0:
                    break
                alloc = min(rem, float(c["max_pallets"]))
                rem -= alloc
                role = "Primary Stop" if idx == 0 else f"Split Stop #{idx+1}"
                print(f"    Stop {idx+1} ({role}): {c['name']} (ID {c['recipient_id']}) -> Allocate {alloc:.1f} Pallets (Max: {c['max_pallets']})")

        # SMS / Dispatch draft
        backups = res["viable_candidates"][1:3]
        backup_name = backups[0]["name"] if backups else "regional food bank backup"
        print("\nReady-to-Send SMS/Email Dispatch Draft:")
        print(
            f"  \"Hi {primary['name']} team - ATL Surplus Broker has a {posting['track']} rescue offer: "
            f"'{posting['posting_text']}'. Spoilage clock: {clock_hours:.0f}h. "
            f"Your {primary['cold_storage']} storage and {primary['max_pallets']}-pallet capacity are verified. "
            f"Can your team confirm intake within {min(int(clock_hours), primary['pickup_window_hours'])} hours? "
            f"Reply YES to lock or NO to route to {backup_name}.\""
        )

    print(f"\nExecution finished in {elapsed:.2f}s.\n")


def main():
    parser = argparse.ArgumentParser(description="Run ATL-07 Hybrid Vector & Lexical Search Engine locally.")
    parser.add_argument("--posting", type=int, default=1, help="Posting ID (1-10) to run matching against.")
    parser.add_argument("--all", action="store_true", help="Run multiple test cases across RETAIL, FARM, and ESSENTIALS.")
    args = parser.parse_args()

    if args.all:
        test_postings = [1, 5, 8, 10]
        print_banner("RUNNING MULTI-POSTING TEST SUITE ACROSS FOOD & ESSENTIALS TRACKS", width=84)
        for pid in test_postings:
            run_posting_match(pid)
    else:
        run_posting_match(args.posting)


if __name__ == "__main__":
    main()
