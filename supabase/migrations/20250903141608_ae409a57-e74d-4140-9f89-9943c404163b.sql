-- Add foreign key constraint between images.uploaded_by and profiles.user_id
ALTER TABLE public.images 
ADD CONSTRAINT images_uploaded_by_profiles_user_id_fkey 
FOREIGN KEY (uploaded_by) REFERENCES public.profiles(user_id) 
ON DELETE SET NULL;