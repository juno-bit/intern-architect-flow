import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, ArrowLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ImageItem {
  id: string;
  name: string;
  url: string;
  project_id?: string;
  task_id?: string;
  uploaded_by: string;
  created_at: string;
  projects?: {
    name: string;
  };
  tasks?: {
    title: string;
  };
  profiles?: {
    full_name: string;
  } | null;
}

interface Project {
  id: string;
  name: string;
}

export default function Gallery() {
  const { user, loading } = useAuth();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>('');

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/auth';
      return;
    }
    if (user) {
      fetchImages();
      fetchProjects();
    }
  }, [user, loading]);

  const fetchImages = async () => {
    try {
      const { data, error } = await supabase
        .from('images')
        .select(`
          *,
          projects (name),
          tasks (title)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const imageIds = data?.map(img => img.uploaded_by).filter(Boolean) || [];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', imageIds);

      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p.full_name]) || []);

      const imagesWithProfiles = (data || []).map(img => ({
        ...img,
        profiles: img.uploaded_by ? { full_name: profilesMap.get(img.uploaded_by) || 'Unknown' } : null
      }));

      setImages(imagesWithProfiles);
    } catch (error) {
      console.error('Error fetching images:', error);
      toast.error('Error loading images');
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/${Math.random()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('WI storage')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('WI storage')
        .getPublicUrl(filePath);

      // Save to database
      const { error: dbError } = await supabase
        .from('images')
        .insert({
          name: file.name,
          url: publicUrl,
          project_id: selectedProject || null,
          uploaded_by: user?.id,
          file_size: file.size,
          mime_type: file.type
        });

      if (dbError) throw dbError;

      toast.success('Image uploaded successfully');
      fetchImages();
      setSelectedProject('');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Error uploading image');
    } finally {
      setUploading(false);
    }
  };

  const deleteImage = async (imageId: string, imageUrl: string) => {
    try {
      // Extract file path from URL for storage deletion
      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `${user?.id}/${fileName}`;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('WI storage')
        .remove([filePath]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('images')
        .delete()
        .eq('id', imageId);

      if (dbError) throw dbError;

      toast.success('Image deleted successfully');
      fetchImages();
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Error deleting image');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => window.location.href = '/dashboard'}
              variant="ghost"
              size="sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Project Gallery</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Upload New Image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select project (optional)</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                
                <label className="flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-md cursor-pointer hover:bg-primary/90 transition-colors min-w-fit">
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Choose Image'}
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {images.map((image) => (
            <Card key={image.id} className="overflow-hidden hover:shadow-lg transition-all duration-200 rounded-xl">
              <div className="aspect-square relative overflow-hidden">
                <img
                  src={image.url}
                  alt={image.name}
                  className="object-cover w-full h-full hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute top-2 right-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteImage(image.id, image.url)}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-4">
                <h3 className="font-medium text-sm truncate mb-2">{image.name}</h3>
                
                <div className="space-y-2">
                  {image.projects?.name && (
                    <Badge variant="outline" className="text-xs bg-blue-500 text-white border-0">
                      {image.projects.name}
                    </Badge>
                  )}
                  
                  {image.tasks?.title && (
                    <Badge variant="secondary" className="text-xs bg-purple-500 text-white">
                      {image.tasks.title}
                    </Badge>
                  )}
                  
                  <div className="text-xs text-muted-foreground">
                    {image.profiles?.full_name || 'Unknown'}
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    {new Date(image.created_at).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {images.length === 0 && (
          <div className="text-center py-12">
            <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No images uploaded yet</h3>
            <p className="text-muted-foreground">Upload your first image to get started</p>
          </div>
        )}
      </main>
    </div>
  );
}