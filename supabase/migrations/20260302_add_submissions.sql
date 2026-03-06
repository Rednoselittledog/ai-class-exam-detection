-- Add Submissions Table for Student Answer Sheets
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Create submissions table
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    field_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    score INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create updated_at trigger for submissions
DROP TRIGGER IF EXISTS update_submissions_updated_at ON submissions;
CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_submissions_exam_id ON submissions(exam_id);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at DESC);

-- 4. Enable RLS
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies if any
DROP POLICY IF EXISTS "Enable read access for all users" ON submissions;
DROP POLICY IF EXISTS "Enable insert access for all users" ON submissions;
DROP POLICY IF EXISTS "Enable update access for all users" ON submissions;
DROP POLICY IF EXISTS "Enable delete access for all users" ON submissions;

-- 6. Create policies for public read/write
CREATE POLICY "Enable read access for all users" ON submissions
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON submissions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON submissions
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON submissions
    FOR DELETE USING (true);

-- Done! 🎉
SELECT 'Submissions table created! ✅' as status;
