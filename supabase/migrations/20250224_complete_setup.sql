-- Complete Supabase Setup Script
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Create exams table (if not exists)
CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    canvas_size INTEGER[] NOT NULL,
    fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    answer_key JSONB DEFAULT '{}'::jsonb,
    image_url TEXT,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_exams_updated_at ON exams;
CREATE TRIGGER update_exams_updated_at BEFORE UPDATE ON exams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Enable RLS
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if any
DROP POLICY IF EXISTS "Enable read access for all users" ON exams;
DROP POLICY IF EXISTS "Enable insert access for all users" ON exams;
DROP POLICY IF EXISTS "Enable update access for all users" ON exams;
DROP POLICY IF EXISTS "Enable delete access for all users" ON exams;

-- 5. Create policies for public read/write
CREATE POLICY "Enable read access for all users" ON exams
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON exams
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON exams
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON exams
    FOR DELETE USING (true);

-- 6. Create storage bucket for answer sheets
INSERT INTO storage.buckets (id, name, public)
VALUES ('answer-sheets', 'answer-sheets', true)
ON CONFLICT (id) DO NOTHING;

-- 7. Drop existing storage policies if any
DROP POLICY IF EXISTS "Public read access for answer-sheets" ON storage.objects;
DROP POLICY IF EXISTS "Public insert access for answer-sheets" ON storage.objects;
DROP POLICY IF EXISTS "Public update access for answer-sheets" ON storage.objects;
DROP POLICY IF EXISTS "Public delete access for answer-sheets" ON storage.objects;

-- 8. Create storage policies
CREATE POLICY "Public read access for answer-sheets"
ON storage.objects FOR SELECT
USING (bucket_id = 'answer-sheets');

CREATE POLICY "Public insert access for answer-sheets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'answer-sheets');

CREATE POLICY "Public update access for answer-sheets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'answer-sheets');

CREATE POLICY "Public delete access for answer-sheets"
ON storage.objects FOR DELETE
USING (bucket_id = 'answer-sheets');

-- 9. Add columns (if not exists)
ALTER TABLE exams ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Done! 🎉
SELECT 'Setup complete! ✅' as status;
