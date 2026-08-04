-- Add invoice branding columns to businesses table
ALTER TABLE businesses 
  ADD COLUMN IF NOT EXISTS invoice_accent_color text DEFAULT '#4f46e5',
  ADD COLUMN IF NOT EXISTS invoice_template text DEFAULT 'classic';

-- invoice_accent_color: hex color for invoice header, table headers, and totals (default: indigo #4f46e5)
-- invoice_template: 'classic' | 'modern' | 'minimal' — controls PDF layout style
-- logo_url already exists in schema
