import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ImageSlideshow } from "./ImageSlideshow";
import { toast } from "sonner";
import { Upload, Edit, Trash2, FolderOpen, Camera, Filter, Search } from "lucide-react";

interface Image {
  id: string;
  name: string;
  url: string;
  description?: string;
  phase?: string;
  image_category: string;
  capture_date: string;
  uploaded_by: string;
  project_id?: string;
  task_id?: string;
  is_featured: boolean;
  sort_order: number;
  file_path?: string;
  profiles?: { full_name: string };
  projects?: { name: string };
  tasks?: { title: string };
}

interface Project {
  id: string;
  name: string;
  phase: string;
  description?: string;
  detailed_description?: string;
  status: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  project_type: string;
}

interface ProjectGalleryProps {
  projectId?: string;
  userId: string;
  userRole: string;
}

const phases = ["Planning", "Foundation", "Structure", "Exterior", "Interior", "Completion"];
const imageCategories = ["Progress", "Design", "Materials", "Issues", "Completed", "Reference"];

export const ProjectGallery = ({ projectId, userId, userRole }: ProjectGalleryProps) => {
  const [images, setImages] = useState<Image[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(projectId || "");
  const [selectedPhase, setSelectedPhase] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [slideshowImages, setSlideshowImages] = useState<Image[]>([]);
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  const [showSlideshow, setShowSlideshow] = useState(false);
  const [editingImage, setEditingImage] = useState<Image | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadData, setUploadData] = useState({
    name: "",
    description: "",
    phase: "Planning",
    category: "Progress",
    projectId: selectedProject,
    taskId: "",
    captureDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchProjects();
    if (selectedProject) {
      fetchImages();
    }
  }, [selectedProject]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProjects(data || []);
      if (!selectedProject && data?.[0]) {
        setSelectedProject(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast.error("Failed to fetch projects");
    }
  };

  const fetchImages = async () => {
    if (!selectedProject) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from("images")
        .select(`
          *,
          profiles:uploaded_by(full_name),
          projects:project_id(name),
          tasks:task_id(title)
        `)
        .eq("project_id", selectedProject)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setImages(data || []);
    } catch (error) {
      console.error("Error fetching images:", error);
      toast.error("Failed to fetch images");
    } finally {
      setLoading(false);
    }
  };

  const filteredImages = images.filter(image => {
    const matchesPhase = selectedPhase === "all" || image.phase === selectedPhase;
    const matchesCategory = selectedCategory === "all" || image.image_category === selectedCategory;
    const matchesSearch = searchTerm === "" || 
      image.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      image.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      image.projects?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesPhase && matchesCategory && matchesSearch;
  });

  const handleImageClick = (imageIndex: number) => {
    setSlideshowImages(filteredImages);
    setSlideshowIndex(imageIndex);
    setShowSlideshow(true);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedProject) return;

    try {
      // Upload to Supabase Storage
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `projects/${selectedProject}/images/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from("WI storage")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("WI storage")
        .getPublicUrl(filePath);

      // Save image metadata to database
      const { error: dbError } = await supabase
        .from("images")
        .insert({
          name: uploadData.name || file.name,
          url: publicUrl,
          description: uploadData.description,
          phase: uploadData.phase,
          image_category: uploadData.category,
          project_id: selectedProject,
          task_id: uploadData.taskId || null,
          uploaded_by: userId,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          capture_date: uploadData.captureDate
        });

      if (dbError) throw dbError;

      toast.success("Image uploaded successfully!");
      setShowUploadDialog(false);
      setUploadData({
        name: "",
        description: "",
        phase: "Planning",
        category: "Progress",
        projectId: selectedProject,
        taskId: "",
        captureDate: new Date().toISOString().split('T')[0]
      });
      fetchImages();
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image: " + error.message);
    }
  };

  const handleEditImage = async () => {
    if (!editingImage) return;

    try {
      const { error } = await supabase
        .from("images")
        .update({
          name: editingImage.name,
          description: editingImage.description,
          phase: editingImage.phase,
          image_category: editingImage.image_category,
          is_featured: editingImage.is_featured
        })
        .eq("id", editingImage.id);

      if (error) throw error;

      toast.success("Image updated successfully!");
      setEditingImage(null);
      fetchImages();
    } catch (error: any) {
      console.error("Error updating image:", error);
      toast.error("Failed to update image: " + error.message);
    }
  };

  const handleDeleteImage = async (imageId: string, filePath: string) => {
    if (!confirm("Are you sure you want to delete this image?")) return;

    try {
      // Delete from storage
      if (filePath) {
        await supabase.storage.from("WI storage").remove([filePath]);
      }

      // Delete from database
      const { error } = await supabase
        .from("images")
        .delete()
        .eq("id", imageId);

      if (error) throw error;

      toast.success("Image deleted successfully!");
      fetchImages();
    } catch (error: any) {
      console.error("Error deleting image:", error);
      toast.error("Failed to delete image: " + error.message);
    }
  };

  const canManageImages = userRole === "chief_architect" || 
    userRole === "junior_architect" ||
    (projects.find(p => p.id === selectedProject && (p as any).created_by === userId));

  const currentProject = projects.find(p => p.id === selectedProject);

  return (
    <div className="space-y-6">
      {/* Project Selection and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Project Gallery
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Select Project" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border z-50">
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedPhase} onValueChange={setSelectedPhase}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="All Phases" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border z-50">
                <SelectItem value="all">All Phases</SelectItem>
                {phases.map((phase) => (
                  <SelectItem key={phase} value={phase}>
                    {phase}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border z-50">
                <SelectItem value="all">All Categories</SelectItem>
                {imageCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search images..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background border-border text-white placeholder:text-muted-foreground"
            />
            </div>
          </div>

          {currentProject && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold">{currentProject.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {currentProject.description}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline">{currentProject.phase}</Badge>
                    <Badge variant="secondary">{currentProject.project_type}</Badge>
                  </div>
                </div>
                <div className="text-sm space-y-1">
                  {currentProject.location && (
                    <p><strong>Location:</strong> {currentProject.location}</p>
                  )}
                  {currentProject.start_date && (
                    <p><strong>Start Date:</strong> {new Date(currentProject.start_date).toLocaleDateString()}</p>
                  )}
                  {currentProject.end_date && (
                    <p><strong>End Date:</strong> {new Date(currentProject.end_date).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {canManageImages && (
            <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Images
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload New Image</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Image name"
                    value={uploadData.name}
                    onChange={(e) => setUploadData({ ...uploadData, name: e.target.value })}
                  />
                  <Textarea
                    placeholder="Description"
                    value={uploadData.description}
                    onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Select value={uploadData.phase} onValueChange={(value) => setUploadData({ ...uploadData, phase: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {phases.map((phase) => (
                          <SelectItem key={phase} value={phase}>
                            {phase}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={uploadData.category} onValueChange={(value) => setUploadData({ ...uploadData, category: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {imageCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Capture Date</label>
                    <Input
                      type="date"
                      value={uploadData.captureDate}
                      onChange={(e) => setUploadData({ ...uploadData, captureDate: e.target.value })}
                    />
                  </div>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleUpload}
                  />
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>

      {/* Image Grid */}
      {loading ? (
        <div className="text-center py-8">Loading images...</div>
      ) : filteredImages.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No images found for the selected filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredImages.map((image, index) => (
            <Card key={image.id} className="overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-200 rounded-xl">
              <div className="relative">
                <img
                  src={image.url}
                  alt={image.name}
                  className="w-full h-48 object-cover"
                  onClick={() => handleImageClick(index)}
                />
                {image.is_featured && (
                  <Badge className="absolute top-2 left-2" variant="secondary">
                    Featured
                  </Badge>
                )}
                {canManageImages && (
                  <div className="absolute top-2 right-2">
                    <div className="flex gap-1 bg-black/70 backdrop-blur-sm rounded p-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingImage(image);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Are you sure you want to delete this image?")) {
                            handleDeleteImage(image.id, image.file_path || "");
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <CardContent className="p-3">
                <h4 className="font-medium text-sm truncate">{image.name}</h4>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {currentProject?.project_type && (
                    <Badge variant="secondary" className="text-xs capitalize">
                      {currentProject.project_type}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(image.capture_date).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Image Slideshow */}
      {showSlideshow && (
        <ImageSlideshow
          images={slideshowImages}
          initialIndex={slideshowIndex}
          onClose={() => setShowSlideshow(false)}
        />
      )}

      {/* Edit Image Dialog */}
      {editingImage && (
        <Dialog open={!!editingImage} onOpenChange={() => setEditingImage(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Image</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Image name"
                value={editingImage.name}
                onChange={(e) => setEditingImage({ ...editingImage, name: e.target.value })}
              />
              <Textarea
                placeholder="Description"
                value={editingImage.description || ""}
                onChange={(e) => setEditingImage({ ...editingImage, description: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-4">
                <Select
                  value={editingImage.phase || ""}
                  onValueChange={(value) => setEditingImage({ ...editingImage, phase: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select phase" />
                  </SelectTrigger>
                  <SelectContent>
                    {phases.map((phase) => (
                      <SelectItem key={phase} value={phase}>
                        {phase}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={editingImage.image_category}
                  onValueChange={(value) => setEditingImage({ ...editingImage, image_category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {imageCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleEditImage}>Save Changes</Button>
                <Button variant="outline" onClick={() => setEditingImage(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};