-- Create storage bucket for market images
INSERT INTO storage.buckets (id, name, public)
VALUES ('market-images', 'market-images', true);

-- Create RLS policies for the bucket
CREATE POLICY "Market images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'market-images');

CREATE POLICY "Admins can upload market images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'market-images' 
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update market images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'market-images' 
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete market images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'market-images' 
  AND public.has_role(auth.uid(), 'admin')
);

-- Add image metadata columns to markets table
ALTER TABLE public.markets
ADD COLUMN IF NOT EXISTS image_zoom numeric DEFAULT 1,
ADD COLUMN IF NOT EXISTS image_position_x numeric DEFAULT 50,
ADD COLUMN IF NOT EXISTS image_position_y numeric DEFAULT 50;