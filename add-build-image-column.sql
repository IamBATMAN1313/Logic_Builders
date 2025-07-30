-- Add image column to build table for default build images
ALTER TABLE build 
ADD COLUMN IF NOT EXISTS image_url VARCHAR(500) DEFAULT 'https://via.placeholder.com/400x300/2c3e50/ffffff?text=PC+Build';
