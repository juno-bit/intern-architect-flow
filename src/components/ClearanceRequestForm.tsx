import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare, Clock, CheckCircle, AlertTriangle, Upload, X, FileText } from "lucide-react";

interface Task {
  id: string;
  title: string;
  project_id?: string;
  priority: string;
  status: string;
  due_date?: string;
  projects?: { name: string };
}

interface Project {
  id: string;
  name: string;
}

interface UploadedFile {
  name: string;
  url: string;
  type: string;
  size: number;
}

interface ClearanceRequestFormProps {
  userId: string;
  userRole: string;
}

const urgencyLevels = [
  { value: 'low', label: 'Low Priority', color: 'bg-green-500' },
  { value: 'medium', label: 'Medium Priority', color: 'bg-yellow-500' },
  { value: 'high', label: 'High Priority', color: 'bg-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-500' }
];

export const ClearanceRequestForm = ({ userId, userRole }: ClearanceRequestFormProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [clearanceForm, setClearanceForm] = useState({
    task_id: '',
    project_id: '',
    notes: '',
    urgency: 'medium',
    supporting_documents: ''
  });

  useEffect(() => {
    fetchData();
  }, [userId]);

  // Chief architects don't request clearances
  if (userRole === 'chief_architect') {
    return null;
  }

  const fetchData = async () => {
    try {
      const { data: tasksData } = await supabase
        .from('tasks')
        .select(`*, projects:project_id(name)`)
        .eq('assigned_to', userId)
        .neq('status', 'completed')
        .order('due_date', { ascending: true });

      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');

      setTasks(tasksData || []);
      setProjects(projectsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error loading form data');
    }
  };

  const filteredTasks = tasks.filter(task => 
    !clearanceForm.project_id || task.project_id === clearanceForm.project_id
  );

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `clearances/${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('WI storage')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('WI storage')
          .getPublicUrl(fileName);

        setUploadedFiles(prev => [...prev, {
          name: file.name,
          url: publicUrl,
          type: file.type,
          size: file.size
        }]);
      }
      toast.success('File(s) uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file: ' + error.message);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSubmitClearance = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clearanceForm.task_id) {
      toast.error('Please select a task');
      return;
    }

    if (!clearanceForm.notes.trim()) {
      toast.error('Please provide clearance notes');
      return;
    }

    try {
      setSubmitting(true);

      const notesWithAttachments = uploadedFiles.length > 0
        ? `${clearanceForm.notes}\n\n--- Attachments ---\n${uploadedFiles.map(f => `${f.name}: ${f.url}`).join('\n')}`
        : clearanceForm.notes;
      
      const { error } = await supabase
        .from('task_clearances')
        .insert({
          task_id: clearanceForm.task_id,
          requested_by: userId,
          status: 'pending',
          notes: notesWithAttachments
        });

      if (error) throw error;

      toast.success('Clearance request submitted successfully!');
      setShowForm(false);
      setClearanceForm({
        task_id: '',
        project_id: '',
        notes: '',
        urgency: 'medium',
        supporting_documents: ''
      });
      setUploadedFiles([]);
    } catch (error: any) {
      console.error('Error submitting clearance:', error);
      toast.error('Failed to submit clearance request: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTask = tasks.find(task => task.id === clearanceForm.task_id);
  const urgencyConfig = urgencyLevels.find(level => level.value === clearanceForm.urgency);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Request Task Clearance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Dialog open={showForm} onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setUploadedFiles([]);
        }}>
          <DialogTrigger asChild>
            <Button variant="success" size="lg" className="w-full">
              <CheckCircle className="h-4 w-4 mr-2" />
              Request Clearance
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Submit Clearance Request</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitClearance} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Project (Optional)</label>
                  <Select
                    value={clearanceForm.project_id}
                    onValueChange={(value) => {
                      if (value === 'clear-filter') {
                        setClearanceForm({ ...clearanceForm, project_id: '', task_id: '' });
                      } else {
                        setClearanceForm({ ...clearanceForm, project_id: value, task_id: '' });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by project (optional)" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50 text-foreground">
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Urgency Level</label>
                  <Select
                    value={clearanceForm.urgency}
                    onValueChange={(value) => setClearanceForm({ ...clearanceForm, urgency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50 text-foreground">
                      {urgencyLevels.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${level.color}`}></div>
                            {level.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Select Task *</label>
                <Select
                  value={clearanceForm.task_id}
                  onValueChange={(value) => setClearanceForm({ ...clearanceForm, task_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a task to request clearance for" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50 text-foreground">
                    {filteredTasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{task.title}</span>
                          <div className="flex gap-2 mt-1">
                            <Badge className={`bg-${task.priority === 'urgent' ? 'red' : task.priority === 'high' ? 'orange' : task.priority === 'medium' ? 'yellow' : 'green'}-500 text-white text-xs`}>
                              {task.priority}
                            </Badge>
                            {task.projects?.name && (
                              <Badge variant="outline" className="text-xs">
                                {task.projects.name}
                              </Badge>
                            )}
                            {task.due_date && (
                              <Badge variant="secondary" className="text-xs">
                                Due: {new Date(task.due_date).toLocaleDateString()}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTask && (
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Task Context
                  </h4>
                  <div className="mt-2 space-y-2">
                    <p><strong>Title:</strong> {selectedTask.title}</p>
                    <p><strong>Status:</strong> 
                      <Badge className="ml-2 bg-green-500 text-white">
                        {selectedTask.status}
                      </Badge>
                    </p>
                    {selectedTask.projects?.name && (
                      <p><strong>Project:</strong> {selectedTask.projects.name}</p>
                    )}
                    {selectedTask.due_date && (
                      <p><strong>Due Date:</strong> {new Date(selectedTask.due_date).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Clearance Notes *</label>
                <Textarea
                  placeholder="Please provide detailed information about what work has been completed and what needs to be cleared..."
                  value={clearanceForm.notes}
                  onChange={(e) => setClearanceForm({ ...clearanceForm, notes: e.target.value })}
                  required
                  rows={4}
                  className="min-h-[100px]"
                />
              </div>

              {/* File Upload Section */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Attachments (Images & Documents)</label>
                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                  <label className="cursor-pointer flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {uploading ? 'Uploading...' : 'Click to upload images or documents'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Supports images, PDFs, CAD files (.dwg, .dxf, .rvt, .skp), and documents
                    </span>
                    <Input
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.dwf,.rvt,.skp,.ifc,.pln,.txt,.csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                        {file.type.startsWith('image/') ? (
                          <img src={file.url} alt={file.name} className="h-10 w-10 rounded object-cover" />
                        ) : (
                          <FileText className="h-10 w-10 text-muted-foreground p-1" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(index)}
                          className="h-8 w-8"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {urgencyConfig && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">
                    This request will be marked as: 
                    <Badge className={`ml-2 ${urgencyConfig.color} text-white`}>
                      {urgencyConfig.label}
                    </Badge>
                  </span>
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  variant="success"
                  size="lg"
                  className="flex-1" 
                  disabled={submitting || uploading}
                >
                  {submitting ? 'Submitting...' : 'Submit Clearance Request'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  size="lg"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
