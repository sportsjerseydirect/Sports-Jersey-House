-- Idempotent dev catalogue seed for staging/demo (matches packages/database/src/seed/dev-catalog.ts)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM products WHERE source_payload->>'seedTag' = 'dev-catalog-v1' LIMIT 1
  ) THEN
    RETURN;
  END IF;

  INSERT INTO products (slug, title, description, vendor, product_type, sport, league, team, status, source_payload, created_by, updated_by)
  VALUES
    ('chicago-bears-classic-home-jersey', 'Chicago Bears Classic Home Jersey', 'Premium dev-catalog jersey inspired by Chicago Bears home colours for local storefront testing.', 'Sports Jersey House Dev', 'Jersey', 'Football', 'NFL', 'Chicago Bears', 'published', '{"seedTag":"dev-catalog-v1","origin":"supabase-seed"}'::jsonb, 'dev-seed', 'dev-seed'),
    ('green-bay-packers-throwback-jersey', 'Green Bay Packers Throwback Jersey', 'Throwback-style dev product for search and grid rendering checks.', 'Sports Jersey House Dev', 'Jersey', 'Football', 'NFL', 'Green Bay Packers', 'published', '{"seedTag":"dev-catalog-v1","origin":"supabase-seed"}'::jsonb, 'dev-seed', 'dev-seed'),
    ('los-angeles-lakers-icon-edition-jersey', 'Los Angeles Lakers Icon Edition Jersey', 'Basketball dev-catalog listing with league and team metadata for faceted search later.', 'Sports Jersey House Dev', 'Jersey', 'Basketball', 'NBA', 'Los Angeles Lakers', 'published', '{"seedTag":"dev-catalog-v1","origin":"supabase-seed"}'::jsonb, 'dev-seed', 'dev-seed'),
    ('toronto-maple-leafs-authentic-home-jersey', 'Toronto Maple Leafs Authentic Home Jersey', 'Hockey dev product seeded for Canadian market pricing checks.', 'Sports Jersey House Dev', 'Jersey', 'Hockey', 'NHL', 'Toronto Maple Leafs', 'published', '{"seedTag":"dev-catalog-v1","origin":"supabase-seed"}'::jsonb, 'dev-seed', 'dev-seed'),
    ('manchester-city-home-kit', 'Manchester City Home Kit', 'Soccer dev-catalog product for full-text search across league and team fields.', 'Sports Jersey House Dev', 'Kit', 'Soccer', 'Premier League', 'Manchester City', 'published', '{"seedTag":"dev-catalog-v1","origin":"supabase-seed"}'::jsonb, 'dev-seed', 'dev-seed'),
    ('real-madrid-away-kit', 'Real Madrid Away Kit', 'European football dev listing used to validate catalogue pagination and cards.', 'Sports Jersey House Dev', 'Kit', 'Soccer', 'La Liga', 'Real Madrid', 'published', '{"seedTag":"dev-catalog-v1","origin":"supabase-seed"}'::jsonb, 'dev-seed', 'dev-seed'),
    ('new-york-yankees-cooperstown-jersey', 'New York Yankees Cooperstown Jersey', 'Baseball dev product for mixed-sport catalogue rendering.', 'Sports Jersey House Dev', 'Jersey', 'Baseball', 'MLB', 'New York Yankees', 'published', '{"seedTag":"dev-catalog-v1","origin":"supabase-seed"}'::jsonb, 'dev-seed', 'dev-seed'),
    ('dallas-cowboys-stitched-away-jersey', 'Dallas Cowboys Stitched Away Jersey', 'Additional NFL dev listing to exercise multi-product grids locally.', 'Sports Jersey House Dev', 'Jersey', 'Football', 'NFL', 'Dallas Cowboys', 'published', '{"seedTag":"dev-catalog-v1","origin":"supabase-seed"}'::jsonb, 'dev-seed', 'dev-seed');

  INSERT INTO product_variants (product_id, sku, title, price_amount, currency_code, inventory_quantity, is_available, created_by, updated_by)
  SELECT p.id, v.sku, v.title, v.price::numeric, v.currency, v.qty, v.qty > 0, 'dev-seed', 'dev-seed'
  FROM (VALUES
    ('chicago-bears-classic-home-jersey', 'DEV-BEARS-HOME-M', 'Medium', '129.99', 'USD', 25),
    ('green-bay-packers-throwback-jersey', 'DEV-PACKERS-TB-L', 'Large', '139.99', 'USD', 18),
    ('los-angeles-lakers-icon-edition-jersey', 'DEV-LAKERS-ICON-M', 'Medium', '119.99', 'USD', 30),
    ('toronto-maple-leafs-authentic-home-jersey', 'DEV-LEAFS-HOME-L', 'Large', '149.99', 'CAD', 12),
    ('manchester-city-home-kit', 'DEV-CITY-HOME-M', 'Medium', '109.99', 'USD', 22),
    ('real-madrid-away-kit', 'DEV-MADRID-AWAY-L', 'Large', '114.99', 'USD', 16),
    ('new-york-yankees-cooperstown-jersey', 'DEV-YANKEES-COOP-M', 'Medium', '124.99', 'USD', 20),
    ('dallas-cowboys-stitched-away-jersey', 'DEV-COWBOYS-AWAY-XL', 'Extra Large', '134.99', 'USD', 14)
  ) AS v(slug, sku, title, price, currency, qty)
  JOIN products p ON p.slug = v.slug;

  INSERT INTO product_images (product_id, url, alt_text, sort_order, created_by, updated_by)
  SELECT p.id, '/dev/jersey-placeholder.svg', p.title || ' placeholder', 0, 'dev-seed', 'dev-seed'
  FROM products p
  WHERE p.source_payload->>'seedTag' = 'dev-catalog-v1';

  INSERT INTO collections (slug, title, description, status, created_by, updated_by)
  VALUES
    ('nfl-jerseys', 'NFL Jerseys', 'Development collection for National Football League jerseys in the local dev catalogue.', 'published', 'dev-seed', 'dev-seed'),
    ('nba-jerseys', 'NBA Jerseys', 'Development collection for National Basketball Association jerseys.', 'published', 'dev-seed', 'dev-seed'),
    ('nhl-jerseys', 'NHL Jerseys', 'Development collection for National Hockey League jerseys.', 'published', 'dev-seed', 'dev-seed'),
    ('premier-league-kits', 'Premier League Kits', 'Development collection for Premier League football kits.', 'published', 'dev-seed', 'dev-seed'),
    ('mlb-jerseys', 'MLB Jerseys', 'Development collection for Major League Baseball jerseys.', 'published', 'dev-seed', 'dev-seed')
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO collection_products (collection_id, product_id, sort_order)
  SELECT c.id, p.id, row_number() OVER (PARTITION BY c.id ORDER BY p.title) - 1
  FROM collections c
  JOIN products p ON p.league = CASE c.slug
    WHEN 'nfl-jerseys' THEN 'NFL'
    WHEN 'nba-jerseys' THEN 'NBA'
    WHEN 'nhl-jerseys' THEN 'NHL'
    WHEN 'premier-league-kits' THEN 'Premier League'
    WHEN 'mlb-jerseys' THEN 'MLB'
  END
  WHERE p.status = 'published' AND p.deleted_at IS NULL
  ON CONFLICT DO NOTHING;
END $$;
