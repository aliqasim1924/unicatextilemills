-- Migration: Add updated_at column to fabric_rolls and loom_rolls

ALTER TABLE fabric_rolls ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE loom_rolls ADD COLUMN IF NOT EXISTS updated_at timestamptz; 