-- Migration: Add archived column to fabric_rolls
ALTER TABLE fabric_rolls ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false; 