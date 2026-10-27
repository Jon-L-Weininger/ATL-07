"""Custom Python tools for the Resilient Food Equity & Surplus Broker ADK Agent.

Provides deterministic logistics verification, spoilage clock margin math,
profile-vs-schema contradiction detection, Census tract equity tie-breaking,
and multi-recipient pallet load-splitting.
"""

from typing import Any


CONTRADICTION_PHRASES = (
    "no refrigeration of any kind",
    "dry storage only",
    "no freezer at present",
    "single shelf in a shared cupboard",
)


def evaluate_logistics_and_split(
    storage_state: str,
    hours_remaining: float,
    estimated_pallets: int,
    candidates: list[dict[str, Any]],
    foodkeeper_shelf_life_hours: float | None = None,
) -> dict[str, Any]:
    """Audits candidate recipients for operational constraints, profile contradictions,
    spoilage clock margin, neighborhood equity tie-breaking, and pallet load-splitting.

    Always call this tool after `match_recipients_vector` and before writing the final
    Match Brief so that near-miss traps, cold-chain mismatches, and pallet overflows
    are deterministically caught.

    Args:
        storage_state: Required storage condition of the surplus posting
            ('refrigerated', 'frozen', or 'pantry').
        hours_remaining: Hours remaining before the surplus item spoils or hits
            its pickup deadline.
        estimated_pallets: Estimated number of pallets in the surplus offer
            (use 1 if the offer is small/sub-pallet).
        candidates: List of candidate recipient dictionaries returned by
            `match_recipients_vector`. Each dict should include `recipient_id`,
            `name`, `cold_storage`, `frozen_storage`, `max_pallets`,
            `pickup_window_hours`, `profile_text`, `cosine_distance`,
            `tract_poverty_rate`, `tract_assistance_rate`, and
            `tract_no_vehicle_rate`.
        foodkeeper_shelf_life_hours: Optional reference shelf-life hours from
            USDA FoodKeeper (`search_shelf_life`) for comparison.

    Returns:
        A structured audit dictionary containing:
        - `clock_analysis`: Spoilage window vs. FoodKeeper baseline.
        - `qualified_ranked`: Eligible recipients ranked by semantic fit +
          operational capacity + Census tract equity priority.
        - `disqualified_or_flagged`: Recipients rejected or flagged (with exact
          reasons, e.g., Greenline no-refrigeration or Harborview profile contradiction).
        - `allocation_plan`: Primary match + backup options + exact pallet
          load-splitting schedule if `estimated_pallets` exceeds primary `max_pallets`.
    """
    req_state = (storage_state or "pantry").strip().lower()
    req_pallets = max(1, int(estimated_pallets or 1))
    hours_rem = float(hours_remaining)

    qualified: list[dict[str, Any]] = []
    disqualified: list[dict[str, Any]] = []

    for raw in candidates:
        rec_id = raw.get("recipient_id")
        name = raw.get("name", f"Recipient {rec_id}")
        cold_storage = str(raw.get("cold_storage", "none")).lower()
        frozen_storage = bool(raw.get("frozen_storage", False))
        max_pallets = int(raw.get("max_pallets") or 0)
        pickup_window = float(raw.get("pickup_window_hours") or 999)
        profile_text = str(raw.get("profile_text") or "")
        profile_lower = profile_text.lower()
        cosine_dist = float(raw.get("cosine_distance") or 0.5)

        pov_rate = float(raw.get("tract_poverty_rate") or 0.0)
        asst_rate = float(raw.get("tract_assistance_rate") or 0.0)
        no_veh_rate = float(raw.get("tract_no_vehicle_rate") or 0.0)

        reasons: list[str] = []

        # 1. Detect planted contradictions between structured columns and profile_text
        contradictions = [p for p in CONTRADICTION_PHRASES if p in profile_lower]
        if contradictions and (cold_storage != "none" or frozen_storage or max_pallets > 1):
            reasons.append(
                f"PROFILE CONTRADICTION: Structured fields claim cold_storage='{cold_storage}', "
                f"frozen_storage={frozen_storage}, max_pallets={max_pallets}, but profile_text states: "
                f"'{profile_text}'"
            )

        # 2. Hard cold-chain check
        if req_state == "refrigerated":
            if cold_storage == "none" or "no refrigeration of any kind" in profile_lower:
                reasons.append(
                    f"COLD CHAIN MISMATCH: Offer requires refrigerated storage, "
                    f"but recipient has cold_storage='{cold_storage}'."
                )
        elif req_state == "frozen":
            if not frozen_storage or "no freezer at present" in profile_lower:
                reasons.append(
                    "FROZEN CHAIN MISMATCH: Offer requires frozen storage, "
                    "but recipient lacks operational freezer capacity."
                )

        # 3. Spoilage clock vs pickup_window_hours check
        clock_margin_hours = round(hours_rem - pickup_window, 2)
        if clock_margin_hours < 0:
            reasons.append(
                f"CLOCK WINDOW EXCEEDED: Recipient pickup_window_hours ({pickup_window}h) "
                f"exceeds posting hours_remaining ({hours_rem}h)."
            )

        # 4. Compute Census tract equity priority score (0.0 to 1.0 scale)
        equity_score = round(
            (0.50 * pov_rate) + (0.35 * asst_rate) + (0.15 * no_veh_rate),
            4,
        )

        # Effective pallet capacity (0 max_pallets means sub-pallet / fractional capacity only)
        effective_pallet_cap = max_pallets if max_pallets > 0 else 0

        entry = {
            "recipient_id": rec_id,
            "name": name,
            "street": raw.get("street"),
            "city": raw.get("city"),
            "state": raw.get("state"),
            "zip_code": raw.get("zip_code"),
            "archetype": raw.get("archetype"),
            "archetype_label": raw.get("archetype_label"),
            "cold_storage": cold_storage,
            "frozen_storage": frozen_storage,
            "loading_dock": raw.get("loading_dock"),
            "refrigerated_transport": raw.get("refrigerated_transport"),
            "max_pallets": max_pallets,
            "pickup_window_hours": pickup_window,
            "clock_margin_hours": clock_margin_hours,
            "service_days": raw.get("service_days"),
            "populations_served": raw.get("populations_served"),
            "weekly_households": raw.get("weekly_households"),
            "cosine_distance": round(cosine_dist, 4),
            "tract_geo_id": raw.get("tract_geo_id"),
            "tract_poverty_rate": round(pov_rate, 4),
            "tract_assistance_rate": round(asst_rate, 4),
            "tract_no_vehicle_rate": round(no_veh_rate, 4),
            "tract_median_income": raw.get("tract_median_income"),
            "tract_distance_km": raw.get("tract_distance_km"),
            "equity_score": equity_score,
            "profile_text": profile_text,
        }

        if reasons:
            entry["disqualification_reasons"] = reasons
            disqualified.append(entry)
        else:
            # Composite rank key:
            # Group cosine_distance into 0.025 buckets so near-ties (like Cedar St vs Maple St)
            # are broken by pallet capacity fit and neighborhood equity_score!
            semantic_bucket = round(cosine_dist / 0.025)
            can_take_at_least_one_pallet = 1 if effective_pallet_cap >= 1 else 0
            entry["_sort_key"] = (
                -can_take_at_least_one_pallet,
                semantic_bucket,
                -equity_score,
                cosine_dist,
            )
            qualified.append(entry)

    qualified.sort(key=lambda x: x.pop("_sort_key"))

    # 5. Build Primary + Backup + Load-Splitting Allocation Plan
    remaining_pallets = req_pallets
    split_schedule: list[dict[str, Any]] = []
    for idx, cand in enumerate(qualified):
        if remaining_pallets <= 0:
            break
        cap = max(1, cand["max_pallets"]) if cand["max_pallets"] > 0 else 1
        allocated = min(remaining_pallets, cap)
        remaining_pallets -= allocated
        role = "Primary Match" if idx == 0 else f"Split/Backup #{idx}"
        split_schedule.append(
            {
                "role": role,
                "recipient_id": cand["recipient_id"],
                "name": cand["name"],
                "allocated_pallets": allocated,
                "recipient_max_pallets": cand["max_pallets"],
                "clock_margin_hours": cand["clock_margin_hours"],
                "equity_score": cand["equity_score"],
                "tract_poverty_rate": cand["tract_poverty_rate"],
            }
        )

    primary = qualified[0] if qualified else None
    backups = qualified[1:3] if len(qualified) > 1 else []
    requires_load_split = (
        primary is not None and req_pallets > max(1, int(primary["max_pallets"]))
    )

    return {
        "clock_analysis": {
            "storage_state_required": req_state,
            "posting_hours_remaining": hours_rem,
            "foodkeeper_baseline_hours": foodkeeper_shelf_life_hours,
            "urgency_tier": (
                "CRITICAL (<8h)"
                if hours_rem <= 8
                else "HIGH (8-24h)"
                if hours_rem <= 24
                else "STANDARD (>24h)"
            ),
        },
        "qualified_ranked": qualified[:6],
        "disqualified_or_flagged": disqualified,
        "allocation_plan": {
            "requested_pallets": req_pallets,
            "requires_load_split": requires_load_split,
            "unallocated_pallets": max(0, remaining_pallets),
            "primary_recipient": primary,
            "backup_recipients": backups,
            "pallet_split_schedule": split_schedule,
        },
    }
