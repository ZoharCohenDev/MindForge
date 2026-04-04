-- Add sub_expressions column to notes table
-- This stores an array of sub-expression objects as JSONB
-- Each object contains: { expression: string, name: string, value: string }

ALTER TABLE public.notes 
ADD COLUMN IF NOT EXISTS sub_expressions JSONB DEFAULT NULL;

-- Create an index for better query performance on notes with sub_expressions
CREATE INDEX IF NOT EXISTS idx_notes_sub_expressions ON public.notes USING GIN (sub_expressions);

