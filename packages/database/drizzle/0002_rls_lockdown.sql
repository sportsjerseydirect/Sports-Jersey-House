-- Lock down public tables from Supabase Data API; allow read on published catalogue only.
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_public_read ON public.products
  FOR SELECT TO anon, authenticated
  USING (status = 'published' AND deleted_at IS NULL);

CREATE POLICY product_variants_public_read ON public.product_variants
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.status = 'published' AND p.deleted_at IS NULL
    ) AND deleted_at IS NULL
  );

CREATE POLICY product_images_public_read ON public.product_images
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.status = 'published' AND p.deleted_at IS NULL
    ) AND deleted_at IS NULL
  );

CREATE POLICY collections_public_read ON public.collections
  FOR SELECT TO anon, authenticated
  USING (status = 'published' AND deleted_at IS NULL);

CREATE POLICY collection_products_public_read ON public.collection_products
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = collection_id AND c.status = 'published' AND c.deleted_at IS NULL
    )
  );
