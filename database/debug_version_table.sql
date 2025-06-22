-- Debug script to check document_versions table structure
-- Run this to see what columns exist in your table

-- 1. Check if the table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'document_versions'
) as table_exists;

-- 2. List all columns in the document_versions table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'document_versions'
ORDER BY ordinal_position;

-- 3. Check specifically for is_automatic column
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'document_versions' 
            AND column_name = 'is_automatic'
        ) 
        THEN 'Column is_automatic EXISTS'
        ELSE 'Column is_automatic is MISSING - This is the problem!'
    END as status; 