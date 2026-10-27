# Challenge 2 (`a4i_food`) — Data Reference & Engineering Notes

> Reference notes generated from [`README.md`](README.md) and [`notebooks/c2_01_load_explore.ipynb`](notebooks/c2_01_load_explore.ipynb) for building the Resilient Food Equity & Surplus Broker.

---

## 1. Environment & Dataset Configuration

- **GCP Project ID (from notebook output):** `qwiklabs-gcp-04-e7160ff57547`
- **BigQuery Dataset:** `a4i_food` (Region: `US` — **critical**: any BigQuery connection used for `AI.EMBED` / `VECTOR_SEARCH` must also be in `US`, not `us-central1`).
- **Embedding Model (`EMBED_ENDPOINT`):** `gemini-embedding-2` (3,072 dimensions). Do not mix models between corpus embedding and query embedding. Do not use `gemini-embedding-001` in bulk.
- **Notebook Execution Caveats Observed in Repo:**
  1. Cell 1 currently has `METRO = "Chicago"` (default) rather than `"Atlanta"` (`("GA", 33.55, 33.92, -84.55, -84.28)`).
  2. Cell 16 in the saved `.ipynb` raised a `TypeError: sequence item 3: expected str instance, float found` in pandas 3.0 (`products.astype(str)` left floats or NA in `r.values`) before Cell 24 (`load BigQuery tables`) ran. If tables are missing or on the wrong metro, either fix `r.astype(str)` in Cell 16 and re-run, or run `bash scripts/load.sh <metro>`.

---

## 2. Provenance Split (Judge Question — Memorize & Surface)

- **REAL Data:**
  - **Organizations (`recipients` where `profile_source = 'generated'`):** IRS Exempt Organizations Business Master File (`eo_<state>.csv`), public domain (17 U.S.C. § 105). Filtered to active (`STATUS = '01'`) food/shelter/clinic NTEE prefixes: `K30`, `K31`, `K34`, `K35`, `K36`, `L41`, `E32`. Real `ein`, `name`, `street`, `city`, `state`, `zip_code`, `ntee_code`, and `reported_income` (`INCOME_AMT`).
  - **Privacy hygiene:** `ICO` ("In Care Of" — often a volunteer's personal name) is dropped on sight. `street` is kept for truck routing, with the explicit caveat that for tiny pantries it may be a residential address.
  - **Coordinates:** Public ZIP-code polygon centroids (`bigquery-public-data.geo_us_boundaries.zip_codes` via `ST_CENTROID`), **not** street-level geocodes. Good for metro filtering and rough census tract association, not turn-by-turn drive times unless augmented with Google Maps API.
  - **Shelf Life (`shelf_life`):** USDA FSIS FoodKeeper (CC0, 661 products), pinned at [`data/foodkeeper.json`](data/foodkeeper.json) because federal hosts block datacenter IPs (`403 Forbidden`). Caveat: consumer home-storage freshness guidance, not commercial cold-chain science.
  - **Neighborhood Need (`tract_demographics`):** US Census American Community Survey (`bigquery-public-data.census_bureau_acs.censustract_*`) joined to `bigquery-public-data.geo_census_tracts.us_census_tracts_national`.
- **GENERATED / SYNTHETIC Data:**
  - **Operational attributes & `profile_text` on `recipients`:** Deterministically seeded from `SHA-256(EIN)` using 14 archetypes in [`data/profile_components.json`](data/profile_components.json) (modeled on real public profiles from Seattle/King County and Pennsylvania).
  - **Scale placement:** Real `reported_income` (`INCOME_AMT`) log-scales each org within its archetype's `max_pallets` and `weekly_households` range. Note: `reported_income = 0` means *unknown* (990-N postcard filer), not necessarily tiny, so `0` draws from the lower-middle of the archetype band rather than the floor.
  - **9 Planted Teaching Cases (`profile_source = 'planted'`):** Synthetic orgs with `ein` starting with `P` (`P00000000`–`P00000008`), blank `street`/`zip_code`, placed near the metro center (`CENTRE_LAT`, `CENTRE_LON`).
  - **Surplus offers (`surplus_postings`):** 10 synthetic offers across `RETAIL`, `FARM`, and `ESSENTIALS`.

---

## 3. Table Schemas in `a4i_food`

### Table 1: `a4i_food.recipients`
| Column | Type | Notes |
|---|---|---|
| `recipient_id` | `INT64` | Unique sequential ID (`1..N`) |
| `ein` | `STRING` | 9-char IRS EIN (or `P00000000`–`P00000008` for planted cases) |
| `name` | `STRING` | Title-cased organization name |
| `street`, `city`, `state`, `zip_code` | `STRING` | 5-digit `zip_code` (`zfill(5)`). Empty on `planted` rows |
| `ntee_code` | `STRING` | Starts with `K30`, `K31`, `K34`, `K35`, `K36`, `L41`, or `E32` |
| `archetype` | `STRING` | One of 14 archetypes (e.g., `neighborhood_pantry`, `regional_foodbank`, `shelter_kitchen`, `mobile_pantry`, `community_clinic`, `diaper_bank`, `halal_kosher`, etc.) or `planted` |
| `archetype_label` | `STRING` | Human-readable archetype description |
| `cold_storage` | `STRING` | `'none'`, `'domestic'`, `'commercial'`, `'walk-in'`, `'medical'`, `'vehicle'` |
| `frozen_storage` | `BOOL` | Whether freezer capacity exists |
| `loading_dock` | `BOOL` | Dock-height receiving capability |
| `refrigerated_transport` | `BOOL` | Whether org can self-collect chilled loads |
| `max_pallets` | `INT64` | Maximum pallet capacity (`0` to `20+`) |
| `pickup_window_hours` | `INT64` | Hours needed to arrange pickup/collection |
| `weekly_households` | `INT64` | Estimated weekly households served |
| `reported_income` | `FLOAT64` | Real IRS `INCOME_AMT` (`0.0` = unknown / 990-N filer) |
| `populations_served` | `STRING` | Target population notes |
| `service_days` | `STRING` | Days open (e.g., `"Tuesday, Thursday"`) |
| `profile_text` | `STRING` | Free-text operational profile (embed target) |
| `profile_source` | `STRING` | `'generated'` (real IRS org + generated ops) or `'planted'` (9 test cases) |
| `latitude`, `longitude` | `FLOAT64` | ZIP centroid (or fanned around metro center for `planted`) |

#### The 9 Planted Cases in `recipients` (Critical for Validation & Demo)
1. **Near-Miss Decoy — `Greenline Community Pantry` (`P00000000`):**
   - `cold_storage = 'none'`, `max_pallets = 1`
   - Text: *"Our families ask for fresh greens and salad vegetables more than anything else. We have no refrigeration of any kind - dry storage only - so we can only take produce that will be handed out the same morning it arrives."*
   - **Trap:** Ranks at the top of semantic search for spinach/produce. **Must be filtered out** by `cold_storage` / clock constraints.
2. **Contradiction — `Harborview Neighbors Trust` (`P00000001`):**
   - `cold_storage = 'walk-in'`, `frozen_storage = True`, `max_pallets = 6`
   - Text: *"We operate a large walk-in freezer and can accept full pallets of frozen protein. Storage is a single shelf in a shared cupboard and we have no freezer at present."*
   - **Trap:** Structured flags say `walk-in` + `frozen_storage = True`, but prose contradicts itself. Agent/validation should flag or distrust contradictory profiles.
3. **Genuine Ties — `Cedar Street Produce Alliance` (`P00000002`) & `Maple Street Produce Alliance` (`P00000003`):**
   - Both: `cold_storage = 'walk-in'`, `refrigerated_transport = True`, `loading_dock = True`, `max_pallets = 10`, `weekly_households = 600`.
   - **Trap:** Operationally identical, phrased differently. Requires an explicit tie-breaking rule (e.g., tract need score, distance, or capacity utilization).
4. **5 Vocabulary Mismatch Cases (`P00000004`–`P00000008`):**
   - `Ridgeway Avenue Food Ministry` (`walk-in`, 3 pallets — *"cold chain capacity"*)
   - `Southline Neighbors Pantry` (`walk-in`, 3 pallets — *"walk-in cooler out back"*)
   - `Third Ward Community Table` (`domestic`, 1 pallet — *"We have a fridge. It is not big"*)
   - `Brookfield Family Resource Center` (`walk-in`, 3 pallets — *"Refrigerated storage available"*)
   - `Lakeshore Mutual Aid Collective` (`commercial`, 3 pallets — *"Chilled holding"*)

---

### Table 2: `a4i_food.surplus_postings`
| `posting_id` | `track` | `posting_text` | `foodkeeper_product` | `storage_state` | `hours_available` | `shelf_life_hours` | `hours_remaining` |
|---:|---|---|---|---|---:|---:|---:|
| 1 | `RETAIL` | 10 crates of spinach, harvested yesterday, needs cold storage | `Lettuce` | `refrigerated` | 6 | 168.0 | 6.0 |
| 2 | `RETAIL` | mixed dairy - about 60 gallons of milk and some yogurt, 2 days to code date | `Milk` | `refrigerated` | 8 | `NULL` (`see_package`) | 8.0 |
| 3 | `RETAIL` | roughly 200 loaves of day-old bread and pastries from three store locations | `Bread` | `pantry` | 24 | 48.0+ | 24.0 |
| 4 | `RETAIL` | prepared sandwiches and salads from the deli case, must move tonight | `Leftovers` | `refrigerated` | 4 | 72.0 | 4.0 |
| 5 | `FARM` | 5 tons of potatoes still in the field, we can load pallets if someone collects | `Potatoes` | `pantry` | 72 | 720.0+ | 72.0 |
| 6 | `FARM` | half a truckload of blueberries, picked this morning, extremely perishable | `Blueberries` | `refrigerated` | 12 | 168.0 | 12.0 |
| 7 | `FARM` | surplus winter squash, about 30 bins, no refrigeration needed | `Spaghetti squash` | `pantry` | 120 | 168.0+ | 120.0 |
| 8 | `ESSENTIALS` | 48 cases of sealed infant formula, 8 months to expiry | `Liquid concentrate or ready-to-feed formula` | `pantry` | 168 | `NULL` (`not_specified` unopened) | 168.0 |
| 9 | `ESSENTIALS` | pallet of diapers and wipes, sizes 1 through 4 | `NULL` | `pantry` | 720 | `NULL` | 720.0 |
| 10 | `ESSENTIALS` | temperature-sensitive nutritional supplements for a clinic, cold chain required | `Formula` | `refrigerated` | 8 | 24.0 | 8.0 |

- **`hours_remaining`** = `MIN(hours_available, shelf_life_hours)` (falls back to `hours_available` when `shelf_life_hours` is `NULL`).
- **Load-splitting case:** Posting 5 (*"5 tons of potatoes"*) and Posting 6 (*"half a truckload of blueberries"*) exceed what small pantries can take alone.

---

### Table 3: `a4i_food.shelf_life`
- **Columns:** `product_id`, `product_name`, `product_subtitle`, `keywords`, `category`, `refrigerated_hours`, `refrigerated_note`, `pantry_hours`, `pantry_note`.
- **Quirk 1 (Vocabulary):** `"Spinach"` is not in `product_name`; it is in `product_subtitle` under `product_name = 'Lettuce'`. Always search across `product_name`, `product_subtitle`, and `keywords` (or use semantic search on FoodKeeper products!).
- **Quirk 2 (Sentinels):** `refrigerated_note` / `pantry_note` values are `'ok'`, `'shelf_stable'` (17,520 hrs), `'ripeness_dependent'` (72 hrs), `'not_recommended'` (`NULL` hrs), `'see_package'` (`NULL` hrs), `'not_specified'` (`NULL` hrs). Never treat `NULL` hours as `0` (expired).

---

### Table 4: `a4i_food.tract_demographics`
- **Columns:**
  - `geo_id` (`STRING`, 11-char FIPS, e.g., `'13121001001'`)
  - `tract_lat`, `tract_lon` (`FLOAT64`, internal point of tract)
  - `total_pop` (`FLOAT64`)
  - `median_income` (`FLOAT64`)
  - `poverty_rate` (`FLOAT64`, `0.0`–`1.0`)
  - `no_vehicle_rate` (`FLOAT64`, `0.0`–`1.0`)
  - `assistance_rate` (`FLOAT64`, `0.0`–`1.0` — households receiving public assistance **or** SNAP/food stamps; state accurately as "public assistance or SNAP")
- **How to join `recipients` to `tract_demographics`:**
  - Nearest census tract internal point via `ST_DISTANCE(ST_GEOGPOINT(r.longitude, r.latitude), ST_GEOGPOINT(t.tract_lon, t.tract_lat))` using `QUALIFY ROW_NUMBER() OVER (PARTITION BY r.recipient_id ORDER BY distance_m ASC) = 1`.

---

## 4. BigQuery Vector Search Syntax & 4 Traps (Section 14)

1. **`AI.EMBED` returns `STRUCT<result ARRAY<FLOAT64>, status STRING>`** — extract `.result` as `embedding`.
2. **Filter out failed embeddings:** `WHERE embedded.status = ''`.
3. **Do NOT use a vector index (`CREATE VECTOR INDEX`):** Corpus is <10 MB so an index stays empty. Always pass `options => '{"use_brute_force":true}'` to `VECTOR_SEARCH`.
4. **Region match:** Dataset and connection must both be in `US`.

```sql
-- 1. Materialize recipient embeddings once
CREATE OR REPLACE TABLE `a4i_food.recipient_embeddings` AS
SELECT
  * EXCEPT (embedded),
  embedded.result AS embedding
FROM (
  SELECT r.*, AI.EMBED(r.profile_text, endpoint => 'gemini-embedding-2') AS embedded
  FROM `a4i_food.recipients` r
)
WHERE embedded.status = '';

-- 2. Query via VECTOR_SEARCH (candidate generation before constraint filtering)
SELECT base.recipient_id, base.name, base.cold_storage, base.max_pallets, distance
FROM VECTOR_SEARCH(
  TABLE `a4i_food.recipient_embeddings`, 'embedding',
  (SELECT AI.EMBED(@query_text, endpoint => 'gemini-embedding-2').result AS embedding),
  top_k => 25,
  options => '{"use_brute_force":true}'
);
```
