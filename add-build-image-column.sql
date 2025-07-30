-- Add image column to build table for default build images
ALTER TABLE build 
ADD COLUMN IF NOT EXISTS image_url VARCHAR(500) DEFAULT 'https://assets.ibuypower.com/images/configurator/gaming-pc-template.jpg';
