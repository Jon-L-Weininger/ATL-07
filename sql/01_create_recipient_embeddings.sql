-- Phase 1: Materialize recipient_embeddings with nearest Census Tract demographics
-- Dataset: qwiklabs-gcp-04-e7160ff57547.a4i_food
-- Embedding Model: gemini-embedding-2 via BigQuery AI.EMBED

CREATE OR REPLACE TABLE `qwiklabs-gcp-04-e7160ff57547.a4i_food.recipient_embeddings` AS
WITH recipient_with_tract AS (
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
    t.geo_id AS tract_geo_id,
    t.total_pop AS tract_total_pop,
    t.median_income AS tract_median_income,
    t.poverty_rate AS tract_poverty_rate,
    t.no_vehicle_rate AS tract_no_vehicle_rate,
    t.assistance_rate AS tract_assistance_rate,
    ROUND(
      ST_DISTANCE(
        ST_GEOGPOINT(r.longitude, r.latitude),
        ST_GEOGPOINT(t.tract_lon, t.tract_lat)
      ) / 1000.0,
      2
    ) AS tract_distance_km
  FROM `qwiklabs-gcp-04-e7160ff57547.a4i_food.recipients` r
  CROSS JOIN `qwiklabs-gcp-04-e7160ff57547.a4i_food.tract_demographics` t
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY r.recipient_id
    ORDER BY ST_DISTANCE(
      ST_GEOGPOINT(r.longitude, r.latitude),
      ST_GEOGPOINT(t.tract_lon, t.tract_lat)
    )
  ) = 1
),
embedded AS (
  SELECT
    rt.*,
    AI.EMBED(
      rt.profile_text,
      connection_id => 'us.vertex_ai',
      endpoint => 'gemini-embedding-2'
    ) AS emb
  FROM recipient_with_tract rt
)
SELECT
  * EXCEPT(emb),
  profile_text AS summary,
  emb.result AS embedding
FROM embedded
WHERE emb.status = ''
  AND ARRAY_LENGTH(emb.result) > 0;
