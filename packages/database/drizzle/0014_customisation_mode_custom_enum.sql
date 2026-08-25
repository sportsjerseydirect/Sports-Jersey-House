-- Add SJD customisation mode enum label (separate from any statement that uses it).
ALTER TYPE customisation_mode ADD VALUE IF NOT EXISTS 'custom';
