import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, Image, FolderOpen, Calendar, Tag } from 'lucide-react';

interface Project {
  id: string;
  name: string;
}

interface Task {
  id: string;
  title: string;
  project_id?: string;
}

interface ImageUploadFormProps {
  userId: string;
  onUploadComplete?: () => void;
}

export default function ImageUploadForm({ userId, onUploadComplete }: ImageUploadFormProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageForm, setImageForm] = useState({
    description: '',
    project_id: '',
    task_id: '',
    phase: '',
    image_category: 'progress',
    capture_date: new Date().toISOString().split('T')[0],
    is_featured: false
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch projects
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');

      // Fetch tasks
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('id, title, project_id')
        .order('title');

      setProjects(projectsData || []);
      setTasks(tasksData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error loading form data');
    }
  };

  const filteredTasks = tasks.filter(task => 
    !imageForm.project_id || task.project_id === imageForm.project_id
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const uploadImage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      toast.error('Please select an image file');
      return;
    }

    if (!imageForm.description.trim()) {
      toast.error('Please provide a description');
      return;
    }

    try {
      setUploading(true);
      
      // Generate unique filename
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${imageForm.project_id || 'general'}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('WI storage')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('WI storage')
        .getPublicUrl(filePath);

      // Save image record to database
      const { error: dbError } = await supabase
        .from('images')
        .insert([{
          name: selectedFile.name,
          url: publicUrl,
          file_path: filePath,
          description: imageForm.description,
          project_id: imageForm.project_id || null,
          task_id: imageForm.task_id || null,
          phase: imageForm.phase || null,
          image_category: imageForm.image_category,
          capture_date: imageForm.capture_date,
          is_featured: imageForm.is_featured,
          uploaded_by: userId,
          file_size: selectedFile.size,
          mime_type: selectedFile.type
        }]);

      if (dbError) throw dbError;

      toast.success('Image uploaded successfully');
      
      // Reset form
      setSelectedFile(null);
      setImageForm({
        description: '',
        project_id: '',
        task_id: '',
        phase: '',
        image_category: 'progress',
        capture_date: new Date().toISOString().split('T')[0],
        is_featured: false
      });
      
      setShowForm(false);
      onUploadComplete?.();
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const imageCategories = [
    { value: 'progress', label: 'Progress Photo' },
    { value: 'final', label: 'Final Result' },
    { value: 'before', label: 'Before Photo' },
    { value: 'detail', label: 'Detail Shot' },
    { value: 'documentation', label: 'Documentation' },
    { value: 'presentation', label: 'Presentation' }
  ];

  const phases = [
    'Planning',
    'Foundation',
    'Framing',
    'Electrical',
    'Plumbing',
    'Insulation',
    'Drywall',
    'Flooring',
    'Painting',
    'Finishing',
    'Landscaping',
    'Final Inspection'
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          Upload Project Image
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button className="w-full">
              <Upload className="h-4 w-4 mr-2" />
              Upload Image
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload Project Image</DialogTitle>
            </DialogHeader>
            <form onSubmit={uploadImage} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Image *</label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  required
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description *</label>
                <Textarea
                  placeholder="Describe what this image shows..."
                  value={imageForm.description}
                  onChange={(e) => setImageForm({ ...imageForm, description: e.target.value })}
                  required
                  rows={3}
                />
              </div>

              <Select
                value={imageForm.project_id}
                onValueChange={(value) => setImageForm({ ...imageForm, project_id: value, task_id: '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project (optional)" />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border z-50">
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4" />
                        {project.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {imageForm.project_id && (
                <Select
                  value={imageForm.task_id}
                  onValueChange={(value) => setImageForm({ ...imageForm, task_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Link to task (optional)" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    {filteredTasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select
                value={imageForm.phase}
                onValueChange={(value) => setImageForm({ ...imageForm, phase: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Project phase (optional)" />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border z-50">
                  {phases.map((phase) => (
                    <SelectItem key={phase} value={phase}>
                      {phase}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={imageForm.image_category}
                onValueChange={(value) => setImageForm({ ...imageForm, image_category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Image category" />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border z-50">
                  {imageCategories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        {category.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Capture Date
                </label>
                <Input
                  type="date"
                  value={imageForm.capture_date}
                  onChange={(e) => setImageForm({ ...imageForm, capture_date: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="featured"
                  checked={imageForm.is_featured}
                  onChange={(e) => setImageForm({ ...imageForm, is_featured: e.target.checked })}
                />
                <label htmlFor="featured" className="text-sm">
                  Mark as featured image
                </label>
              </div>

              <div className="flex space-x-2">
                <Button type="submit" className="flex-1" disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Upload Image'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}