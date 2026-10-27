"""Unit tests for surplus_postings_view and recipient fulfilments workflow."""

from fastapi.testclient import TestClient

from agent.atl_broker.tools import (
    assemble_match_brief,
    get_active_postings,
    submit_recipient_fulfilment,
)
from agent.server import app

client = TestClient(app)


def test_postings_have_donor_name_and_fulfilment_fields():
    postings = get_active_postings()
    assert len(postings) > 0
    first = postings[0]
    assert "donor_name" in first
    assert "posting_id" in first
    assert "status" in first
    assert "fulfilment_status" in first


def test_submit_recipient_fulfilment_and_brief():
    # Submit a fulfilment for posting 1
    posting_id = 1
    recipient_id = 122  # Maple Street Produce Alliance
    product_id = 291

    res = submit_recipient_fulfilment(
        posting_id=posting_id,
        recipient_id=recipient_id,
        product_id=product_id,
        fulfilled=True,
    )
    assert res["success"] is True
    assert res["posting_id"] == posting_id
    assert res["recipient_id"] == recipient_id
    assert res["fulfilled"] is True

    # Verify brief reflects fulfilment
    brief = assemble_match_brief(posting_id)
    assert brief.get("fulfilment") is not None
    assert brief["fulfilment"]["is_fulfilled"] is True
    assert brief["fulfilment"]["recipient_id"] == recipient_id

    # Verify active posting in cache has updated status
    postings = get_active_postings()
    target = next((p for p in postings if p["posting_id"] == posting_id), None)
    assert target is not None
    assert target["status"] == "fulfilled"
    assert target["fulfilment_status"] == "fulfilled"
    assert target["fulfilled_recipient_id"] == recipient_id

    # Re-open the posting
    res_reopen = submit_recipient_fulfilment(
        posting_id=posting_id,
        recipient_id=recipient_id,
        product_id=product_id,
        fulfilled=False,
    )
    assert res_reopen["success"] is True
    assert res_reopen["fulfilled"] is False

    brief_reopen = assemble_match_brief(posting_id)
    assert brief_reopen["fulfilment"]["is_fulfilled"] is False


def test_api_fulfilment_endpoints():
    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.json()
    assert "live_counts" in data
    assert "fulfilments" in data["live_counts"]

    # Test POST /api/fulfilments
    post_res = client.post(
        "/api/fulfilments",
        json={
            "posting_id": 2,
            "recipient_id": 124,
            "product_id": 27,
            "fulfilment_flg": True,
        },
    )
    assert post_res.status_code == 200
    post_data = post_res.json()
    assert post_data["result"]["success"] is True
    assert post_data["brief"]["fulfilment"]["is_fulfilled"] is True

    # Test GET /api/fulfilments
    get_res = client.get("/api/fulfilments")
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert "fulfilments" in get_data
    assert any(f["posting_id"] == 2 for f in get_data["fulfilments"])

    # Reset posting 2
    client.post(
        "/api/fulfilments",
        json={
            "posting_id": 2,
            "recipient_id": 124,
            "product_id": 27,
            "fulfilment_flg": False,
        },
    )
