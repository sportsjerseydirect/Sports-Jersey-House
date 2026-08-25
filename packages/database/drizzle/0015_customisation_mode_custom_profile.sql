-- Allow jersey-standard profile to include SJD "custom" mode after enum label exists.
UPDATE customisation_profiles
SET
  allowed_modes = ARRAY['none', 'name', 'number', 'name_number', 'message', 'custom']::customisation_mode[],
  updated_at = now(),
  updated_by = 'product-options-migration-0015'
WHERE slug = 'jersey-standard' AND deleted_at IS NULL;
