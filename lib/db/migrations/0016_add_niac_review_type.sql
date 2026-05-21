-- Add NIAC review type field to trace_matters
ALTER TABLE trace_matters ADD COLUMN IF NOT EXISTS niac_review_type VARCHAR(80);
