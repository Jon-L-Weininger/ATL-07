-- Phase 1 Verification: Test VECTOR_SEARCH + operational constraints + tract equity tie-breaker
-- Querying with Posting #1: "10 crates of spinach, harvested yesterday, needs cold storage" (6 hours remaining)

SELECT
  base.recipient_id,
  base.name,
  base.archetype_label,
  base.city,
  base.cold_storage,
  base.max_pallets,
  base.pickup_window_hours,
  base.tract_geo_id,
  ROUND(base.tract_poverty_rate, 3) AS poverty_rate,
  ROUND(base.tract_assistance_rate, 3) AS assistance_rate,
  ROUND(distance, 4) AS cosine_distance,
  SUBSTR(base.profile_text, 1, 120) AS profile_snippet
FROM VECTOR_SEARCH(
  TABLE `qwiklabs-gcp-04-e7160ff57547.a4i_food.recipient_embeddings`,
  'embedding',
  (
    SELECT
      AI.EMBED(
        '10 crates of spinach, harvested yesterday, needs cold storage',
        connection_id => 'us.vertex_ai',
        endpoint => 'gemini-embedding-2'
      ).result AS embedding
  ),
  top_k => 15,
  distance_type => 'COSINE',
  options => '{"use_brute_force":true}'
)
WHERE base.cold_storage != 'none'
  AND base.pickup_window_hours <= 6
ORDER BY distance ASC, base.tract_poverty_rate DESC;
