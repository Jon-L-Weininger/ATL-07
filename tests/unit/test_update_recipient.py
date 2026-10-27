"""Unit tests for updating surplus recipients and primary agent safety guardrails."""

from agent.atl_broker.tools import (
    assemble_match_brief,
    reset_surplus_recipient,
    update_surplus_recipient,
)


def test_update_surplus_recipient_success():
    # Posting #1 is refrigerated spinach requiring cold storage
    # Recipient #64 is Second Helpings Atlanta Inc with walk-in refrigeration
    res = update_surplus_recipient(
        posting_id=1,
        recipient_id=64,
        note="Emergency outreach by coordinator",
    )
    assert res["success"] is True
    assert "Primary Agent assigned Posting #1" in res["message"]
    brief = res["brief"]
    assert brief["primary_match"]["recipient_id"] == 64
    assert brief["is_manual_assignment"] is True
    assert brief["coordinator_note"] == "Emergency outreach by coordinator"
    assert any("Assigned via Primary Agent" in why for why in brief["why_them"])

    # Clean up
    reset_res = reset_surplus_recipient(posting_id=1)
    assert reset_res["success"] is True
    assert reset_res["brief"]["is_manual_assignment"] is False


def test_update_surplus_recipient_safety_guardrail_decoy():
    # Recipient #119 is Greenline Community Pantry (cold_storage='none', max_pallets=1)
    # Posting #1 requires refrigerated storage and ~1.5 pallets
    res = update_surplus_recipient(posting_id=1, recipient_id=119)
    assert res["success"] is False
    assert res.get("warning") is True
    assert "Primary Agent Safety Guardrail" in res["error"]
    assert "Cold-Chain Safety Block" in res["error"]
    assert len(res["rejection_reasons"]) >= 1


def test_update_surplus_recipient_not_found():
    res_bad_post = update_surplus_recipient(posting_id=9999, recipient_id=64)
    assert res_bad_post["success"] is False
    assert "not found" in res_bad_post["error"].lower()

    res_bad_recip = update_surplus_recipient(posting_id=1, recipient_id=9999)
    assert res_bad_recip["success"] is False
    assert "not found" in res_bad_recip["error"].lower()


def test_reset_surplus_recipient():
    # Assign valid recipient #64
    update_surplus_recipient(posting_id=1, recipient_id=64)
    # Verify brief is updated
    brief = assemble_match_brief(posting_id=1)
    assert brief["primary_match"]["recipient_id"] == 64
    assert brief["is_manual_assignment"] is True

    # Reset
    reset_res = reset_surplus_recipient(posting_id=1)
    assert reset_res["success"] is True
    brief_after = assemble_match_brief(posting_id=1)
    assert brief_after["is_manual_assignment"] is False
    assert brief_after["primary_match"]["recipient_id"] != 64
