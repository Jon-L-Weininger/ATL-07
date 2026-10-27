"""Deterministic Atlanta placeholder dataset mirroring BigQuery dataset `a4i_food`.

Tables mirrored:
  1. a4i_food.recipients
  2. a4i_food.surplus_postings
  3. a4i_food.shelf_life
  4. a4i_food.tract_demographics
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# 1. a4i_food.tract_demographics (US Census ACS 5-year estimates for Atlanta, GA)
# ---------------------------------------------------------------------------
TRACT_DEMOGRAPHICS: list[dict] = [
    {
        "geo_id": "13121004200",
        "neighborhood": "West End / Ashview Heights",
        "tract_lat": 33.7392,
        "tract_lon": -84.4178,
        "total_pop": 3840,
        "median_income": 31200.0,
        "poverty_rate": 0.342,
        "no_vehicle_rate": 0.285,
        "assistance_rate": 0.310,
    },
    {
        "geo_id": "13121002600",
        "neighborhood": "English Avenue / Bankhead",
        "tract_lat": 33.7715,
        "tract_lon": -84.4220,
        "total_pop": 2910,
        "median_income": 27450.0,
        "poverty_rate": 0.389,
        "no_vehicle_rate": 0.334,
        "assistance_rate": 0.358,
    },
    {
        "geo_id": "13121005501",
        "neighborhood": "South Atlanta / Pittsburgh",
        "tract_lat": 33.7240,
        "tract_lon": -84.3925,
        "total_pop": 4120,
        "median_income": 33800.0,
        "poverty_rate": 0.315,
        "no_vehicle_rate": 0.262,
        "assistance_rate": 0.294,
    },
    {
        "geo_id": "13121006700",
        "neighborhood": "Lakewood / Sylvan Hills",
        "tract_lat": 33.7048,
        "tract_lon": -84.4062,
        "total_pop": 4650,
        "median_income": 36900.0,
        "poverty_rate": 0.278,
        "no_vehicle_rate": 0.224,
        "assistance_rate": 0.265,
    },
    {
        "geo_id": "13089022500",
        "neighborhood": "Clarkston / East DeKalb Corridor",
        "tract_lat": 33.8095,
        "tract_lon": -84.2840,
        "total_pop": 5390,
        "median_income": 34500.0,
        "poverty_rate": 0.296,
        "no_vehicle_rate": 0.248,
        "assistance_rate": 0.279,
    },
    {
        "geo_id": "13121001900",
        "neighborhood": "Midtown / Old Fourth Ward",
        "tract_lat": 33.7680,
        "tract_lon": -84.3710,
        "total_pop": 5180,
        "median_income": 74200.0,
        "poverty_rate": 0.118,
        "no_vehicle_rate": 0.112,
        "assistance_rate": 0.092,
    },
    {
        "geo_id": "13121008400",
        "neighborhood": "Fulton Industrial / Camp Creek",
        "tract_lat": 33.7510,
        "tract_lon": -84.5120,
        "total_pop": 3420,
        "median_income": 54600.0,
        "poverty_rate": 0.142,
        "no_vehicle_rate": 0.089,
        "assistance_rate": 0.121,
    },
]

# ---------------------------------------------------------------------------
# 2. a4i_food.shelf_life (USDA FoodKeeper CC0 subset with planted subtleties)
# ---------------------------------------------------------------------------
SHELF_LIFE: list[dict] = [
    {
        "product_id": 241,
        "product_name": "Lettuce",
        "product_subtitle": "Spinach, Loose Leaf, Romaine, Bagged Greens",
        "keywords": "spinach, salad greens, leafy greens, spring mix, kale, arugula",
        "category": "Produce - Fresh Vegetables",
        "refrigerated_hours": 120.0,  # 5 days refrigerated
        "refrigerated_note": "Keep in crisper drawer or 36-40°F walk-in; wilts rapidly at room temperature.",
        "pantry_hours": None,
        "pantry_note": "Not safe/viable for ambient pantry storage.",
    },
    {
        "product_id": 102,
        "product_name": "Milk",
        "product_subtitle": "Plain or flavored, whole, low-fat, skim",
        "keywords": "milk, gallon milk, dairy, yogurt, pasteurized",
        "category": "Dairy Products & Eggs",
        "refrigerated_hours": 168.0,  # 7 days after opening / sentinel note
        "refrigerated_note": "package use-by date (USDA sentinel: donor clock governs when tighter than 7d).",
        "pantry_hours": None,
        "pantry_note": "Must remain refrigerated below 40°F.",
    },
    {
        "product_id": 118,
        "product_name": "Yogurt",
        "product_subtitle": "Greek, regular, single-serve cups",
        "keywords": "yogurt, greek yogurt, dairy cups, cultured dairy",
        "category": "Dairy Products & Eggs",
        "refrigerated_hours": 240.0,  # 10 days refrigerated
        "refrigerated_note": "Keep refrigerated at 40°F or below.",
        "pantry_hours": None,
        "pantry_note": "Requires continuous cold chain.",
    },
    {
        "product_id": 310,
        "product_name": "Bread, commercial",
        "product_subtitle": "Loaves, rolls, bagels, bakery pastries",
        "keywords": "bread, bakery, rolls, loaves, pastries, baked goods",
        "category": "Bakery Products",
        "refrigerated_hours": 336.0,
        "refrigerated_note": "14 days refrigerated",
        "pantry_hours": 96.0,  # 4 days ambient pantry
        "pantry_note": "2-4 days at room temperature in sealed packaging.",
    },
    {
        "product_id": 405,
        "product_name": "Deli / Prepared Sandwiches & Salads",
        "product_subtitle": "Store-made sandwiches, wraps, grain bowls, rotisserie",
        "keywords": "deli, prepared sandwiches, wraps, grain bowls, ready-to-eat, catering",
        "category": "Deli & Prepared Foods",
        "refrigerated_hours": 72.0,  # 3 days max refrigerated, donor clock usually 4-6h
        "refrigerated_note": "3-4 days max; retail rescue requires same-shift pickup under 40°F.",
        "pantry_hours": 2.0,
        "pantry_note": "Discard if above 40°F for more than 2 hours.",
    },
    {
        "product_id": 501,
        "product_name": "Infant Formula",
        "product_subtitle": "Unopened powder or ready-to-feed liquid cans",
        "keywords": "formula, infant formula, baby formula, pediatric nutrition",
        "category": "Baby Food & Critical Essentials",
        "refrigerated_hours": 48.0,  # After opening/mixing
        "refrigerated_note": "48 hours once mixed/opened; unopened cans follow manufacturer expiration date.",
        "pantry_hours": 720.0,  # Unopened sealed pantry shelf life governed by donor window
        "pantry_note": "Unopened sealed formula: keep in cool dry indoor storage; never accept expired or dented seals.",
    },
    {
        "product_id": 502,
        "product_name": "Diapers & Infant Hygiene",
        "product_subtitle": "Disposable diapers sizes 1-6, baby wipes, hygiene kits",
        "keywords": "diapers, wipes, size 1, size 2, size 3, size 4, hygiene, infant essentials",
        "category": "Baby Food & Critical Essentials",
        "refrigerated_hours": None,
        "refrigerated_note": "Not applicable",
        "pantry_hours": 8760.0,
        "pantry_note": "indefinitely (keep dry and sealed; donor pickup dock window governs clock).",
    },
    {
        "product_id": 503,
        "product_name": "Clinical Nutritional Supplements (Cold-Chain)",
        "product_subtitle": "Pediatric & renal oral nutrition shakes, clinic electrolyte packs",
        "keywords": "nutritional supplements, clinic shakes, pediatric shakes, medical nutrition, cold-chain essentials",
        "category": "Baby Food & Critical Essentials",
        "refrigerated_hours": 96.0,
        "refrigerated_note": "Requires verified medical or commercial cold storage (36-41°F) and chain-of-custody sign-off.",
        "pantry_hours": None,
        "pantry_note": "Do not store at ambient temperature.",
    },
]

# ---------------------------------------------------------------------------
# 3. a4i_food.recipients (Atlanta IRS 501c3 orgs + 9 planted teaching cases)
# ---------------------------------------------------------------------------
RECIPIENTS: list[dict] = [
    # --- PLANTED CASE 1: Near-Miss Decoy (Top semantic match for spinach, but NO cold storage) ---
    {
        "recipient_id": 901,
        "ein": "58-9000901",
        "name": "Greenline Community Pantry",
        "street": "642 Cascade Ave SW",
        "city": "Atlanta",
        "state": "GA",
        "zip_code": "30310",
        "ntee_code": "K31",
        "archetype": "neighborhood_pantry",
        "archetype_label": "Neighborhood Food Pantry",
        "cold_storage": "none",
        "frozen_storage": False,
        "loading_dock": False,
        "refrigerated_transport": False,
        "max_pallets": 1,
        "pickup_window_hours": 4,
        "weekly_households": 190,
        "reported_income": 94500.0,
        "populations_served": "general,seniors",
        "service_days": "Wed,Sat",
        "profile_text": (
            "Greenline Community Pantry distributes fresh greens, salad vegetables, and leafy produce "
            "every Wednesday and Saturday to 190 households in Southwest Atlanta. Our volunteers love "
            "receiving bagged spinach, kale, and fresh produce for neighborhood families, though we "
            "operate out of a dry parish hall with ambient shelving only and no refrigeration on site."
        ),
        "profile_source": "planted",
        "planted_role": "near_miss_decoy",
        "latitude": 33.7385,
        "longitude": -84.4190,
        "geo_id": "13121004200",
    },
    # --- PLANTED CASE 2: Contradiction Case ---
    {
        "recipient_id": 902,
        "ein": "58-9000902",
        "name": "Harborview Neighbors Trust",
        "street": "418 Joseph E Lowery Blvd NW",
        "city": "Atlanta",
        "state": "GA",
        "zip_code": "30314",
        "ntee_code": "K31",
        "archetype": "neighborhood_pantry",
        "archetype_label": "Neighborhood Food Pantry",
        "cold_storage": "none",
        "frozen_storage": False,
        "loading_dock": False,
        "refrigerated_transport": False,
        "max_pallets": 1,
        "pickup_window_hours": 3,
        "weekly_households": 150,
        "reported_income": 78000.0,
        "populations_served": "general",
        "service_days": "Thu",
        "profile_text": (
            "We maintain a large commercial walk-in freezer and full dairy cold-room capable of holding "
            "five pallets of perishable groceries. Note from coordinator update: we currently operate from "
            "a single hallway cupboard shelf with no refrigerator or freezer plugged in and can only accept "
            "small boxes of shelf-stable crackers."
        ),
        "profile_source": "planted",
        "planted_role": "contradiction",
        "latitude": 33.7695,
        "longitude": -84.4205,
        "geo_id": "13121002600",
    },
    # --- PLANTED CASES 3 & 4: Genuine Tie Pair (Cedar Street vs. Maple Street Produce Alliance) ---
    {
        "recipient_id": 903,
        "ein": "58-9000903",
        "name": "Cedar Street Produce Alliance",
        "street": "880 Murphy Ave SW",
        "city": "Atlanta",
        "state": "GA",
        "zip_code": "30310",
        "ntee_code": "K30",
        "archetype": "produce_coop",
        "archetype_label": "Fresh Produce Recovery Hub",
        "cold_storage": "walk-in",
        "frozen_storage": False,
        "loading_dock": True,
        "refrigerated_transport": True,
        "max_pallets": 10,
        "pickup_window_hours": 8,
        "weekly_households": 600,
        "reported_income": 412000.0,
        "populations_served": "general,families",
        "service_days": "Mon,Tue,Wed,Thu,Fri,Sat",
        "profile_text": (
            "Cedar Street Produce Alliance is a dedicated fresh produce and grocer rescue hub in West End / "
            "Southwest Atlanta with a 40°F walk-in cooler, refrigerated box truck, and ground-level loading "
            "bay. We rescue clamshell leafy greens, bagged spinach, dairy, and cut produce six days a week "
            "for 600 families in high-need transit-dependent tracts."
        ),
        "profile_source": "planted",
        "planted_role": "tie_high_equity_need",
        "latitude": 33.7362,
        "longitude": -84.4145,
        "geo_id": "13121004200",  # West End: 34.2% poverty, 28.5% no-vehicle
    },
    {
        "recipient_id": 904,
        "ein": "58-9000904",
        "name": "Maple Street Produce Alliance",
        "street": "695 Ponce De Leon Ave NE",
        "city": "Atlanta",
        "state": "GA",
        "zip_code": "30308",
        "ntee_code": "K30",
        "archetype": "produce_coop",
        "archetype_label": "Fresh Produce Recovery Hub",
        "cold_storage": "walk-in",
        "frozen_storage": False,
        "loading_dock": True,
        "refrigerated_transport": True,
        "max_pallets": 10,
        "pickup_window_hours": 8,
        "weekly_households": 600,
        "reported_income": 418000.0,
        "populations_served": "general,families",
        "service_days": "Mon,Tue,Wed,Thu,Fri,Sat",
        "profile_text": (
            "Maple Street Produce Alliance is a dedicated fresh produce and grocer rescue hub in Midtown "
            "Atlanta with a 40°F walk-in cooler, refrigerated box truck, and ground-level loading bay. "
            "We rescue clamshell leafy greens, bagged spinach, dairy, and cut produce six days a week "
            "for 600 households across the Ponce corridor."
        ),
        "profile_source": "planted",
        "planted_role": "tie_lower_equity_need",
        "latitude": 33.7702,
        "longitude": -84.3688,
        "geo_id": "13121001900",  # Midtown: 11.8% poverty, 11.2% no-vehicle
    },
    # --- PLANTED CASE 5: Vocabulary Mismatch (uses "chilled dairy & cultured cups" / "morning hearth loaves") ---
    {
        "recipient_id": 905,
        "ein": "58-9000905",
        "name": "Southline Neighbors Pantry",
        "street": "1140 McDaniel St SW",
        "city": "Atlanta",
        "state": "GA",
        "zip_code": "30310",
        "ntee_code": "K31",
        "archetype": "neighborhood_pantry",
        "archetype_label": "Neighborhood Food Pantry",
        "cold_storage": "commercial",
        "frozen_storage": True,
        "loading_dock": False,
        "refrigerated_transport": True,
        "max_pallets": 4,
        "pickup_window_hours": 6,
        "weekly_households": 380,
        "reported_income": 215000.0,
        "populations_served": "families,seniors,children",
        "service_days": "Tue,Wed,Thu,Fri,Sat",
        "profile_text": (
            "Southline Neighbors Pantry operates triple-door commercial reach-in coolers and a refrigerated "
            "cargo van in Pittsburgh / South Atlanta. We specialize in rescuing chilled beverage jugs, "
            "cultured breakfast cups, farmstead dairy, and artisan morning loaves from urban grocers "
            "within a 2-hour dispatch notice."
        ),
        "profile_source": "planted",
        "planted_role": "vocabulary_mismatch",
        "latitude": 33.7255,
        "longitude": -84.3940,
        "geo_id": "13121005501",
    },
    # --- REALISTIC ATLANTA RETAIL & GROCER RECIPIENTS ---
    {
        "recipient_id": 101,
        "ein": "58-1428901",
        "name": "West End Community Table & Kitchen",
        "street": "590 Peeples St SW",
        "city": "Atlanta",
        "state": "GA",
        "zip_code": "30310",
        "ntee_code": "K35",
        "archetype": "soup_kitchen",
        "archetype_label": "Community Meal Program & Soup Kitchen",
        "cold_storage": "walk-in",
        "frozen_storage": True,
        "loading_dock": False,
        "refrigerated_transport": True,
        "max_pallets": 4,
        "pickup_window_hours": 3,
        "weekly_households": 720,
        "reported_income": 540000.0,
        "populations_served": "general,unhoused,seniors",
        "service_days": "Mon,Tue,Wed,Thu,Fri,Sat,Sun",
        "profile_text": (
            "Serving hot daily lunch and evening meals 7 days a week in West End. Equipped with a walk-in "
            "cooler, commercial prep kitchen, and a refrigerated transit van that can dispatch within 60 "
            "minutes for prepared deli trays, sandwiches, rotisserie proteins, bakery rolls, and salad greens."
        ),
        "profile_source": "generated",
        "planted_role": None,
        "latitude": 33.7410,
        "longitude": -84.4160,
        "geo_id": "13121004200",
    },
    {
        "recipient_id": 102,
        "ein": "58-1934412",
        "name": "Bankhead Mobile Grocer & Senior Route",
        "street": "1025 Donald Lee Hollowell Pkwy NW",
        "city": "Atlanta",
        "state": "GA",
        "zip_code": "30318",
        "ntee_code": "K31",
        "archetype": "mobile_pantry",
        "archetype_label": "Mobile Pantry & Transit-Accessible Market",
        "cold_storage": "vehicle",
        "frozen_storage": False,
        "loading_dock": True,
        "refrigerated_transport": True,
        "max_pallets": 6,
        "pickup_window_hours": 6,
        "weekly_households": 510,
        "reported_income": 385000.0,
        "populations_served": "seniors,families,general",
        "service_days": "Mon,Tue,Wed,Thu,Fri",
        "profile_text": (
            "Operates two reefers bringing fresh dairy, eggs, produce, and bakery loaves directly to senior "
            "high-rises and MARTA stations in Bankhead and English Avenue where over 33% of households "
            "lack personal vehicles."
        ),
        "profile_source": "generated",
        "planted_role": None,
        "latitude": 33.7730,
        "longitude": -84.4235,
        "geo_id": "13121002600",
    },
    {
        "recipient_id": 103,
        "ein": "58-2091184",
        "name": "Lakewood Halal & International Family Pantry",
        "street": "1680 Jonesboro Rd SE",
        "city": "Atlanta",
        "state": "GA",
        "zip_code": "30315",
        "ntee_code": "K31",
        "archetype": "halal_kosher",
        "archetype_label": "Culturally Specific & Halal Pantry",
        "cold_storage": "commercial",
        "frozen_storage": True,
        "loading_dock": False,
        "refrigerated_transport": False,
        "max_pallets": 3,
        "pickup_window_hours": 6,
        "weekly_households": 290,
        "reported_income": 176000.0,
        "populations_served": "halal,immigrants,families",
        "service_days": "Tue,Thu,Fri,Sat",
        "profile_text": (
            "Provides fresh produce, dairy, bakery bread, and halal-certified groceries to 290 families "
            "in Lakewood and South Atlanta. Commercial reach-in coolers hold up to 3 pallets of dairy "
            "or boxed greens."
        ),
        "profile_source": "generated",
        "planted_role": None,
        "latitude": 33.7060,
        "longitude": -84.4040,
        "geo_id": "13121006700",
    },
    # --- STRETCH GOAL RECIPIENTS: CRITICAL NON-FOOD ESSENTIALS (Clinics, Diaper Banks, Family Shelters) ---
    {
        "recipient_id": 201,
        "ein": "58-2410988",
        "name": "Atlanta Metro Diaper & Infant Essentials Bank",
        "street": "740 Memorial Dr SE",
        "city": "Atlanta",
        "state": "GA",
        "zip_code": "30316",
        "ntee_code": "P20",
        "archetype": "diaper_bank",
        "archetype_label": "Diaper & Hygiene Essentials Bank",
        "cold_storage": "commercial",
        "frozen_storage": False,
        "loading_dock": True,
        "refrigerated_transport": True,
        "max_pallets": 12,
        "pickup_window_hours": 24,
        "weekly_households": 950,
        "reported_income": 690000.0,
        "populations_served": "infants,children,families",
        "service_days": "Mon,Tue,Wed,Thu,Fri",
        "profile_text": (
            "Dedicated maternal and infant essentials hub serving 950 low-income Atlanta households weekly. "
            "Climate-controlled warehouse with loading dock, lot-number chain-of-custody tracking for "
            "sealed infant formula, and high-turn distribution of diapers (sizes Newborn through 6) and wipes."
        ),
        "profile_source": "generated",
        "planted_role": None,
        "latitude": 33.7260,
        "longitude": -84.3910,
        "geo_id": "13121005501",
    },
    {
        "recipient_id": 202,
        "ein": "58-2590311",
        "name": "Southside Maternal & Pediatric Community Clinic",
        "street": "1046 Ridge Ave SW",
        "city": "Atlanta",
        "state": "GA",
        "zip_code": "30315",
        "ntee_code": "E32",
        "archetype": "community_clinic",
        "archetype_label": "Community Health Clinic Pantry",
        "cold_storage": "medical",
        "frozen_storage": True,
        "loading_dock": False,
        "refrigerated_transport": True,
        "max_pallets": 3,
        "pickup_window_hours": 12,
        "weekly_households": 340,
        "reported_income": 820000.0,
        "populations_served": "infants,pregnant_postpartum,seniors,chronic_illness",
        "service_days": "Mon,Tue,Wed,Thu,Fri,Sat",
        "profile_text": (
            "FQHC community clinic with temperature-logged medical refrigeration (36-41°F), pediatric nurse "
            "intake verification, and courier van. Distributes sealed infant formula, cold-chain clinical "
            "nutritional shakes, electrolyte packs, and size 1-4 diapers directly to WIC-eligible families."
        ),
        "profile_source": "generated",
        "planted_role": None,
        "latitude": 33.7235,
        "longitude": -84.3955,
        "geo_id": "13121005501",
    },
    {
        "recipient_id": 203,
        "ein": "58-2771904",
        "name": "Clarkston Refugee & Family Sanctuary House",
        "street": "3710 Market St",
        "city": "Clarkston",
        "state": "GA",
        "zip_code": "30021",
        "ntee_code": "L41",
        "archetype": "shelter_kitchen",
        "archetype_label": "Emergency Family Shelter & Maternal Program",
        "cold_storage": "commercial",
        "frozen_storage": True,
        "loading_dock": False,
        "refrigerated_transport": True,
        "max_pallets": 4,
        "pickup_window_hours": 8,
        "weekly_households": 420,
        "reported_income": 510000.0,
        "populations_served": "families,infants,immigrants,children",
        "service_days": "Mon,Tue,Wed,Thu,Fri,Sat,Sun",
        "profile_text": (
            "Provides emergency housing, infant care kits, sealed baby formula, diapers (sizes 1-5), "
            "feminine hygiene supplies, and culturally familiar groceries to newly arrived families in "
            "East Metro Atlanta. Commercial cold storage and 7-day intake desk."
        ),
        "profile_source": "generated",
        "planted_role": None,
        "latitude": 33.8090,
        "longitude": -84.2850,
        "geo_id": "13089022500",
    },
]

# ---------------------------------------------------------------------------
# 4. a4i_food.surplus_postings (Primary Track: RETAIL + Stretch Track: ESSENTIALS)
# ---------------------------------------------------------------------------
SURPLUS_POSTINGS: list[dict] = [
    # --- RETAIL & GROCER RESCUE TRACK ---
    {
        "posting_id": 1,
        "track": "RETAIL",
        "donor_name": "Midtown Market Grocer (#104 - Ponce)",
        "donor_lat": 33.7719,
        "donor_lon": -84.3665,
        "posting_text": (
            "18 cases (~1.5 pallets) of triple-washed bagged organic spinach and spring mix in 38°F "
            "produce cooler. Best-by tomorrow; must clear backroom dock within 6 hours before evening truck."
        ),
        "foodkeeper_product": "Spinach",
        "storage_state": "refrigerated",
        "pallets_estimated": 1.5,
        "hours_available": 6.0,
        "shelf_life_hours": 120.0,
        "hours_remaining": 6.0,
        "created_at": "2026-10-27T14:15:00Z",
        "urgency_tier": "critical",
    },
    {
        "posting_id": 2,
        "track": "RETAIL",
        "donor_name": "Peachtree Corner Neighborhood Grocer",
        "donor_lat": 33.9698,
        "donor_lon": -84.2215,
        "posting_text": (
            "12 crates (~2 pallets) of whole & 2% gallon milk plus single-serve Greek yogurt cups, "
            "held at 37°F. 48 hours until printed sell-by date; store requests pickup within 8 hours."
        ),
        "foodkeeper_product": "Milk",
        "storage_state": "refrigerated",
        "pallets_estimated": 2.0,
        "hours_available": 8.0,
        "shelf_life_hours": 168.0,
        "hours_remaining": 8.0,
        "created_at": "2026-10-27T13:40:00Z",
        "urgency_tier": "urgent",
    },
    {
        "posting_id": 3,
        "track": "RETAIL",
        "donor_name": "Grant Park Artisan Bakery & Grocer",
        "donor_lat": 33.7370,
        "donor_lon": -84.3715,
        "posting_text": (
            "140 loaves of day-old multigrain bread, brioche rolls, and bagged Kaiser buns (~1.5 pallets). "
            "Individually bagged at ambient temperature; pickup within 14 hours."
        ),
        "foodkeeper_product": "Bread, commercial",
        "storage_state": "pantry",
        "pallets_estimated": 1.5,
        "hours_available": 14.0,
        "shelf_life_hours": 96.0,
        "hours_remaining": 14.0,
        "created_at": "2026-10-27T12:30:00Z",
        "urgency_tier": "standard",
    },
    {
        "posting_id": 4,
        "track": "RETAIL",
        "donor_name": "Buckhead Fresh Kitchen & Deli",
        "donor_lat": 33.8400,
        "donor_lon": -84.3780,
        "posting_text": (
            "85 individually wrapped turkey & cheddar deli sandwiches, chicken Caesar wraps, and quinoa "
            "protein bowls (~1 pallet) chilled at 38°F. Must be picked up and served within 4 hours."
        ),
        "foodkeeper_product": "Deli / Prepared Sandwiches & Salads",
        "storage_state": "refrigerated",
        "pallets_estimated": 1.0,
        "hours_available": 4.0,
        "shelf_life_hours": 72.0,
        "hours_remaining": 4.0,
        "created_at": "2026-10-27T14:45:00Z",
        "urgency_tier": "critical",
    },
    # --- STRETCH GOAL TRACK: CRITICAL NON-FOOD ESSENTIALS ---
    {
        "posting_id": 5,
        "track": "ESSENTIALS",
        "donor_name": "Perimeter Pharmacy & Regional Distribution Center",
        "donor_lat": 33.9280,
        "donor_lon": -84.3410,
        "posting_text": (
            "16 cases (~1.5 pallets) of factory-sealed infant formula powder & ready-to-feed pediatric "
            "bottles (lot-verified, 9 months to expiration). Dock clearance needed within 10 hours."
        ),
        "foodkeeper_product": "Infant Formula",
        "storage_state": "pantry",
        "pallets_estimated": 1.5,
        "hours_available": 10.0,
        "shelf_life_hours": 720.0,
        "hours_remaining": 10.0,
        "created_at": "2026-10-27T13:10:00Z",
        "urgency_tier": "urgent",
    },
    {
        "posting_id": 6,
        "track": "ESSENTIALS",
        "donor_name": "Midtown Wholesale Club (#082)",
        "donor_lat": 33.7850,
        "donor_lon": -84.4100,
        "posting_text": (
            "4 pallets of unopened disposable diapers (Sizes 1, 2, 3, and 4) and hypoallergenic baby "
            "wipes from packaging transition. Needs loading dock / box truck pickup within 18 hours."
        ),
        "foodkeeper_product": "Diapers & Infant Hygiene",
        "storage_state": "pantry",
        "pallets_estimated": 4.0,
        "hours_available": 18.0,
        "shelf_life_hours": 8760.0,
        "hours_remaining": 18.0,
        "created_at": "2026-10-27T11:20:00Z",
        "urgency_tier": "standard",
    },
    {
        "posting_id": 7,
        "track": "ESSENTIALS",
        "donor_name": "Emory-Midtown Outpatient Nutrition Supply",
        "donor_lat": 33.7690,
        "donor_lon": -84.3870,
        "posting_text": (
            "9 cases (~1 pallet) of cold-chain pediatric & maternal clinical nutritional shakes held at "
            "39°F. Requires verified medical or commercial refrigeration and pickup within 5 hours."
        ),
        "foodkeeper_product": "Clinical Nutritional Supplements (Cold-Chain)",
        "storage_state": "refrigerated",
        "pallets_estimated": 1.0,
        "hours_available": 5.0,
        "shelf_life_hours": 96.0,
        "hours_remaining": 5.0,
        "created_at": "2026-10-27T14:30:00Z",
        "urgency_tier": "critical",
    },
]
