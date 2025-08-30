import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export default function Gallery() {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [project, setProject] = useState('');
  const [date, setDate] = useState('');
  const [phase, setPhase] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(e.target.files);
  };

  const handleUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one image to upload.',
        variant: 'destructive',
      });
      return;
    }

    if (!project || !date || !phase) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const savedImages = JSON.parse(localStorage.getItem('savedImages') || '[]');
      
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        // Convert to base64
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        const imageData = {
          project,
          date,
          phase,
          base64,
          name: file.name,
          uploadDate: new Date().toISOString(),
        };

        savedImages.push(imageData);
      }

      localStorage.setItem('savedImages', JSON.stringify(savedImages));

      toast({
        title: 'Success',
        description: `${selectedFiles.length} image(s) uploaded successfully!`,
      });

      // Reset form
      setSelectedFiles(null);
      setProject('');
      setDate('');
      setPhase('');
      
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to upload images. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 flex justify-center items-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Button 
            onClick={() => navigate('/dashboard')} 
            variant="outline" 
            className="mb-4 self-start"
          >
            ← Back to Dashboard
          </Button>
          <CardTitle className="text-2xl font-bold">Upload Project Images</CardTitle>
          <CardDescription>
            Add images to your project gallery
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project">Project Name</Label>
            <Input
              id="project"
              type="text"
              placeholder="Enter project name"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date (DD/MM/YY)</Label>
            <Input
              id="date"
              type="text"
              placeholder="e.g., 15/08/25"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phase">Project Phase</Label>
            <Select value={phase} onValueChange={setPhase}>
              <SelectTrigger>
                <SelectValue placeholder="Select project phase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Planning">Planning</SelectItem>
                <SelectItem value="Foundation">Foundation</SelectItem>
                <SelectItem value="Structure">Structure</SelectItem>
                <SelectItem value="Exterior">Exterior</SelectItem>
                <SelectItem value="Interior">Interior</SelectItem>
                <SelectItem value="Completion">Completion</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="images">Select Images</Label>
            <Input
              id="images"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="cursor-pointer"
            />
            {selectedFiles && (
              <p className="text-sm text-muted-foreground">
                {selectedFiles.length} file(s) selected
              </p>
            )}
          </div>

          <Button 
            onClick={handleUpload} 
            className="w-full"
            disabled={!selectedFiles || !project || !date || !phase}
          >
            Upload Images
          </Button>

          <div className="text-center">
            <Button 
              onClick={() => navigate('/search')} 
              variant="outline"
              className="w-full"
            >
              View Gallery
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}