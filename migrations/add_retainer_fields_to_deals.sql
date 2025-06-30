-- Migration: Add retainer fields to deals table
-- Date: 2024-01-01
-- Description: Add support for retainer-based deals with monthly recurring revenue tracking

-- Add new columns to the deals table
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS deal_type VARCHAR(20) DEFAULT 'one_time' CHECK (deal_type IN ('one_time', 'retainer')),
ADD COLUMN IF NOT EXISTS retainer_duration_months INTEGER,
ADD COLUMN IF NOT EXISTS retainer_start_date DATE;

-- Add comments for documentation
COMMENT ON COLUMN deals.deal_type IS 'Type of deal: one_time for single payment deals, retainer for monthly recurring revenue';
COMMENT ON COLUMN deals.retainer_duration_months IS 'Number of months for retainer deals (null for one_time deals)';
COMMENT ON COLUMN deals.retainer_start_date IS 'Start date for retainer payments (null for one_time deals)';

-- Create index for better query performance on deal_type
CREATE INDEX IF NOT EXISTS idx_deals_deal_type ON deals(deal_type);

-- Create index for retainer start date for time-based queries
CREATE INDEX IF NOT EXISTS idx_deals_retainer_start_date ON deals(retainer_start_date) WHERE deal_type = 'retainer';

-- Update existing deals to have the default deal_type
UPDATE deals SET deal_type = 'one_time' WHERE deal_type IS NULL;

-- Make deal_type NOT NULL after setting defaults
ALTER TABLE deals ALTER COLUMN deal_type SET NOT NULL; 