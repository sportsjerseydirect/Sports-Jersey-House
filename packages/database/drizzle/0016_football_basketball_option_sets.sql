-- Add confirmed Aris NFL/NBA (football/basketball) size option sets.
-- Size lists extracted from live SJD storefront window.ap_front_settings (Aug 2026).
-- Do not invent sizes beyond Aris evidence.

INSERT INTO product_option_sets (slug, title, sport, sizes, source, created_by, updated_by)
VALUES
(
  'football-jerseys',
  'Football jerseys',
  'Football',
  '["S/Men''s","M/Men''s","L/Men''s","XL/Men''s","2XL/Men''s","3XL/Men''s","Youth S (6–8 yrs)","Youth M (8–10 yrs)","Youth L (10–12 yrs)","Youth XL (12–14 yrs)","1T (1–2 yrs)","2T (2–3 yrs)","3T (3–4 yrs)","4T (4–5 yrs)","5T (5–6 yrs)","6T (6–7 yrs)"]'::jsonb,
  'aris-sjd-live-2026-08',
  'product-options-nfl-nba',
  'product-options-nfl-nba'
),
(
  'basketball-jerseys',
  'Basketball jerseys',
  'Basketball',
  '["S/Men''s","M/Men''s","L/Men''s","XL/Men''s","2XL/Men''s","Youth/XS","Youth/S","Youth/M","Youth/L","Youth/XL","1T (1–2 yrs)","2T (2–3 yrs)","3T (3–4 yrs)","4T (4–5 yrs)","5T (5–6 yrs)","6T (6–7 yrs)","7T (7–8 yrs)"]'::jsonb,
  'aris-sjd-live-2026-08',
  'product-options-nfl-nba',
  'product-options-nfl-nba'
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  sport = EXCLUDED.sport,
  sizes = EXCLUDED.sizes,
  source = EXCLUDED.source,
  updated_at = now(),
  updated_by = 'product-options-nfl-nba';

-- Link Football / Basketball products that already have sport classified.
UPDATE products p
SET
  option_set_id = os.id,
  updated_at = now(),
  updated_by = 'product-options-nfl-nba'
FROM product_option_sets os
WHERE p.deleted_at IS NULL
  AND p.option_set_id IS NULL
  AND os.deleted_at IS NULL
  AND (
    (lower(coalesce(p.sport, '')) = 'football' AND os.slug = 'football-jerseys')
    OR (lower(coalesce(p.sport, '')) = 'basketball' AND os.slug = 'basketball-jerseys')
  );
