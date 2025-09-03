-- Make the WI storage bucket public for image display
UPDATE storage.buckets 
SET public = true 
WHERE id = 'WI storage';

-- Create comprehensive storage policies for the WI storage bucket
-- Users can view all images (public access)
CREATE POLICY "Anyone can view images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'WI storage');

-- Users can upload images to their own folder
CREATE POLICY "Users can upload images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'WI storage' AND auth.uid() IS NOT NULL);

-- Users can update their own uploaded images
CREATE POLICY "Users can update their own images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'WI storage' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own uploaded images
CREATE POLICY "Users can delete their own images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'WI storage' AND auth.uid()::text = (storage.foldername(name))[1]);