"""Unit tests for custom logistics, contradiction, equity, and load-splitting tool."""

from agent.custom_tools import evaluate_logistics_and_split


def test_disqualifies_greenline_and_harborview_traps() -> None:
    candidates = [
        {
            "recipient_id": 119,
            "name": "Greenline Community Pantry",
            "cold_storage": "none",
            "frozen_storage": False,
            "max_pallets": 1,
            "pickup_window_hours": 12,
            "cosine_distance": 0.2100,
            "tract_poverty_rate": 0.3048,
            "tract_assistance_rate": 0.1932,
            "tract_no_vehicle_rate": 0.1500,
            "profile_text": (
                "Our families ask for fresh greens and salad vegetables more than anything else. "
                "We have no refrigeration of any kind - dry storage only."
            ),
        },
        {
            "recipient_id": 120,
            "name": "Harborview Neighbors Trust",
            "cold_storage": "walk-in",
            "frozen_storage": True,
            "max_pallets": 6,
            "pickup_window_hours": 12,
            "cosine_distance": 0.2200,
            "tract_poverty_rate": 0.1837,
            "tract_assistance_rate": 0.2047,
            "tract_no_vehicle_rate": 0.1200,
            "profile_text": (
                "We operate a large walk-in freezer and can accept full pallets of frozen protein. "
                "Storage is a single shelf in a shared cupboard and we have no freezer at present."
            ),
        },
        {
            "recipient_id": 123,
            "name": "Ridgeway Avenue Food Ministry",
            "cold_storage": "walk-in",
            "frozen_storage": False,
            "max_pallets": 3,
            "pickup_window_hours": 12,
            "cosine_distance": 0.2500,
            "tract_poverty_rate": 0.4350,
            "tract_assistance_rate": 0.4821,
            "tract_no_vehicle_rate": 0.4777,
            "profile_text": (
                "Neighborhood food distribution serving local families. "
                "We have cold chain capacity for palletized perishables."
            ),
        },
    ]

    result = evaluate_logistics_and_split(
        storage_state="refrigerated",
        hours_remaining=12.0,
        estimated_pallets=2,
        candidates=candidates,
        foodkeeper_shelf_life_hours=168.0,
    )

    disq_ids = {c["recipient_id"] for c in result["disqualified_or_flagged"]}
    assert 119 in disq_ids
    assert 120 in disq_ids
    assert result["allocation_plan"]["primary_recipient"]["recipient_id"] == 123


def test_equity_tie_breaker_maple_over_cedar() -> None:
    candidates = [
        {
            "recipient_id": 121,
            "name": "Cedar Street Produce Alliance",
            "cold_storage": "walk-in",
            "frozen_storage": False,
            "max_pallets": 10,
            "pickup_window_hours": 12,
            "cosine_distance": 0.2640,
            "tract_poverty_rate": 0.2138,
            "tract_assistance_rate": 0.2674,
            "tract_no_vehicle_rate": 0.2575,
            "profile_text": "Produce-focused redistribution with a walk-in cooler.",
        },
        {
            "recipient_id": 122,
            "name": "Maple Street Produce Alliance",
            "cold_storage": "walk-in",
            "frozen_storage": False,
            "max_pallets": 10,
            "pickup_window_hours": 12,
            "cosine_distance": 0.2650,
            "tract_poverty_rate": 0.3322,
            "tract_assistance_rate": 0.3173,
            "tract_no_vehicle_rate": 0.2516,
            "profile_text": "Fresh produce hub with walk-in refrigeration and our own reefer truck.",
        },
    ]

    result = evaluate_logistics_and_split(
        storage_state="refrigerated",
        hours_remaining=12.0,
        estimated_pallets=5,
        candidates=candidates,
    )

    primary = result["allocation_plan"]["primary_recipient"]
    assert primary["recipient_id"] == 122
    assert primary["name"] == "Maple Street Produce Alliance"


def test_load_splitting_across_recipients() -> None:
    candidates = [
        {
            "recipient_id": 123,
            "name": "Ridgeway Avenue Food Ministry",
            "cold_storage": "walk-in",
            "frozen_storage": False,
            "max_pallets": 3,
            "pickup_window_hours": 12,
            "cosine_distance": 0.2500,
            "tract_poverty_rate": 0.4350,
            "tract_assistance_rate": 0.4821,
            "tract_no_vehicle_rate": 0.4777,
            "profile_text": "We have cold chain capacity for palletized perishables.",
        },
        {
            "recipient_id": 124,
            "name": "Southline Neighbors Pantry",
            "cold_storage": "walk-in",
            "frozen_storage": False,
            "max_pallets": 3,
            "pickup_window_hours": 12,
            "cosine_distance": 0.2550,
            "tract_poverty_rate": 0.3229,
            "tract_assistance_rate": 0.2158,
            "tract_no_vehicle_rate": 0.1800,
            "profile_text": "There is a walk-in cooler out back and a second one for overflow.",
        },
    ]

    result = evaluate_logistics_and_split(
        storage_state="refrigerated",
        hours_remaining=12.0,
        estimated_pallets=5,
        candidates=candidates,
    )

    plan = result["allocation_plan"]
    assert plan["requires_load_split"] is True
    assert plan["unallocated_pallets"] == 0
    assert len(plan["pallet_split_schedule"]) == 2
    assert plan["pallet_split_schedule"][0]["allocated_pallets"] == 3
    assert plan["pallet_split_schedule"][1]["allocated_pallets"] == 2
