import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare, Clock, CheckCircle, AlertTriangle } from "lucide-react";

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
  // Chief architects don't request clearances - they only approve them
  if (userRole === 'chief_architect') {
    return null;
  }

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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

  const fetchData = async () => {
    try {
      // Fetch user's assigned tasks that aren't completed
      const { data: tasksData } = await supabase
        .from('tasks')
        .select(`
          *,
          projects:project_id(name)
        `)
        .eq('assigned_to', userId)
        .neq('status', 'completed')
        .order('due_date', { ascending: true });

      // Fetch projects
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
      
      const { error } = await supabase
        .from('task_clearances')
        .insert({
          task_id: clearanceForm.task_id,
          requested_by: userId,
          status: 'pending',
          notes: clearanceForm.notes
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
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button variant="success" size="lg" className="w-full">
              <CheckCircle className="h-4 w-4 mr-2" />
              Request Clearance
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
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
                    <SelectContent className="bg-background border border-border z-50">
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
                    <SelectContent className="bg-background border border-border z-50">
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
                  <SelectContent className="bg-background border border-border z-50">
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
                      <Badge className={`ml-2 bg-green-500 text-white`}>
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

              <div className="space-y-2">
                <label className="text-sm font-medium">Supporting Documentation (Optional)</label>
                <Textarea
                  placeholder="List any supporting documents, photos, or references that support this clearance request..."
                  value={clearanceForm.supporting_documents}
                  onChange={(e) => setClearanceForm({ ...clearanceForm, supporting_documents: e.target.value })}
                  rows={2}
                />
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
                  disabled={submitting}
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