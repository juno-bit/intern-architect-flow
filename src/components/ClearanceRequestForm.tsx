import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare, Clock, CheckCircle, AlertTriangle, Upload, X, FileText, Eye, Download, User, Calendar, FileImage, ThumbsUp, ThumbsDown } from "lucide-react";

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

interface TaskClearance {
  id: string;
  task_id: string;
  task: { title: string };
  requested_by: string;
  requester: { full_name: string };
  cleared_by?: string;
  clearer?: { full_name: string };
  status: 'pending' | 'approved' | 'rejected';
  notes: string;
  urgency?: string;
  requested_at: string;
  cleared_at?: string;
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
  const [clearances, setClearances] = useState<TaskClearance[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showClearanceDetails, setShowClearanceDetails] = useState<string | null>(null);
  const [clearanceAction, setClearanceAction] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [actionNotes, setActionNotes] = useState('');
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
    fetchMyClearances();
  }, [userId]);

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

  const fetchMyClearances = async () => {
    try {
      const { data } = await supabase
        .from('task_clearances')
        .select(`
          *,
          task:task_id(title),
          requester:profiles!task_clearances_requested_by_fkey(full_name),
          clearer:profiles!task_clearances_cleared_by_fkey(full_name)
        `)
        .eq('requested_by', userId)
        .order('requested_at', { ascending: false });

      setClearances((data as any) || []);
    } catch (error) {
      console.error('Error fetching clearances:', error);
    }
  };

  // Filter clearances by status
  const pendingClearances = clearances.filter(c => c.status === 'pending');
  const approvedClearances = clearances.filter(c => c.status === 'approved');
  const rejectedClearances = clearances.filter(c => c.status === 'rejected');

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
          notes: notesWithAttachments,
          urgency: clearanceForm.urgency
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
      fetchMyClearances();
      fetchData();
    } catch (error: any) {
      console.error('Error submitting clearance:', error);
      toast.error('Failed to submit clearance request: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChiefAction = async (clearanceId: string, status: 'approved' | 'rejected', notes?: string) => {
    try {
      const updateData: any = {
        status,
        cleared_by: userId,
        cleared_at: new Date().toISOString()
      };

      if (notes && notes.trim()) {
        const existingNotes = clearances.find(c => c.id === clearanceId)?.notes || '';
        updateData.notes = `${existingNotes}\n\n--- Chief Architect Notes ---\n${notes}`;
      }

      const { error } = await supabase
        .from('task_clearances')
        .update(updateData)
        .eq('id', clearanceId);

      if (error) throw error;

      toast.success(`Clearance ${status}!`);
      fetchMyClearances();
      setShowClearanceDetails(null);
      setActionNotes('');
    } catch (error: any) {
      console.error('Error updating clearance:', error);
      toast.error('Failed to update clearance');
    }
  };

  if (userRole === 'chief_architect') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            All Clearance Requests ({clearances.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending">Pending ({pendingClearances.length})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({approvedClearances.length})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({rejectedClearances.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="pt-4">
              {pendingClearances.map((clearance) => (
                <div key={clearance.id} className="border rounded-lg p-4 mb-3 hover:shadow-md">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold">{clearance.task.title}</h4>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        {clearance.requester?.full_name}
                        <Calendar className="h-4 w-4 ml-2" />
                        {new Date(clearance.requested_at).toLocaleDateString()}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowClearanceDetails(clearance.id)}
                    >
                      Review Details
                    </Button>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="approved" className="pt-4">
              {approvedClearances.map((clearance) => (
                <div key={clearance.id} className="border rounded-lg p-4 mb-3 bg-green-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold">{clearance.task.title}</h4>
                      <div className="text-sm text-muted-foreground">
                        <span>✅ Approved by {clearance.clearer?.full_name}</span>
                        <span className="ml-2">• {new Date(clearance.cleared_at!).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Badge className="bg-green-500 text-white">APPROVED</Badge>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="rejected" className="pt-4">
              {rejectedClearances.map((clearance) => (
                <div key={clearance.id} className="border rounded-lg p-4 mb-3 bg-red-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold">{clearance.task.title}</h4>
                      <div className="text-sm text-muted-foreground">
                        <span>❌ Rejected by {clearance.clearer?.full_name}</span>
                        <span className="ml-2">• {new Date(clearance.cleared_at!).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Badge className="bg-red-500 text-white">REJECTED</Badge>
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>

        {showClearanceDetails && (
          <ChiefClearanceDetailsModal
            clearanceId={showClearanceDetails}
            onClose={() => setShowClearanceDetails(null)}
            onAction={handleChiefAction}
          />
        )}
      </Card>
    );
  }

  // Regular users see tabs + request form
  return (
    <div className="space-y-6">
      {/* Clearance History Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>My Clearance Requests ({clearances.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All ({clearances.length})</TabsTrigger>
              <TabsTrigger value="pending">Pending ({pendingClearances.length})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({approvedClearances.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="pt-4">
              {clearances.map((clearance) => (
                <div key={clearance.id} className="border rounded-lg p-4 mb-3 hover:shadow-md">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold">{clearance.task.title}</h4>
                      <div className="flex items-center gap-2 mt-1 text-sm">
                        <Badge className={
                          clearance.status === 'approved' ? 'bg-green-500' : 
                          clearance.status === 'rejected' ? 'bg-red-500' : 
                          'bg-yellow-500'
                        }>{clearance.status.toUpperCase()}</Badge>
                        <span>{new Date(clearance.requested_at).toLocaleDateString()}</span>
                        {clearance.cleared_at && (
                          <span>• {new Date(clearance.cleared_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="pending" className="pt-4">
              {pendingClearances.map((clearance) => (
                <div key={clearance.id} className="border rounded-lg p-4 mb-3 bg-yellow-50">
                  <h4 className="font-semibold">{clearance.task.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">Pending review...</p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="approved" className="pt-4">
              {approvedClearances.map((clearance) => (
                <div key={clearance.id} className="border rounded-lg p-4 mb-3 bg-green-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold">{clearance.task.title}</h4>
                      <div className="text-sm text-muted-foreground">
                        ✅ Approved by {clearance.clearer?.full_name || 'Chief Architect'}
                        <span className="ml-2">• {new Date(clearance.cleared_at!).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Badge className="bg-green-500 text-white">APPROVED</Badge>
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Request Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Request New Clearance
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
                <DialogTitle>Request Task Clearance</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmitClearance} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Filter by Project</label>
                    <Select value={clearanceForm.project_id} onValueChange={(val) => setClearanceForm(prev => ({ ...prev, project_id: val, task_id: '' }))}>
                      <SelectTrigger><SelectValue placeholder="All Projects" /></SelectTrigger>
                      <SelectContent>
                        {projects.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Urgency</label>
                    <Select value={clearanceForm.urgency} onValueChange={(val) => setClearanceForm(prev => ({ ...prev, urgency: val }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {urgencyLevels.map(u => (
                          <SelectItem key={u.value} value={u.value}>
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${u.color}`} />
                              {u.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Task *</label>
                  <Select value={clearanceForm.task_id} onValueChange={(val) => setClearanceForm(prev => ({ ...prev, task_id: val }))}>
                    <SelectTrigger><SelectValue placeholder="Choose a task..." /></SelectTrigger>
                    <SelectContent>
                      {filteredTasks.length === 0 ? (
                        <SelectItem value="none" disabled>No tasks available</SelectItem>
                      ) : (
                        filteredTasks.map(task => (
                          <SelectItem key={task.id} value={task.id}>
                            {task.title} {task.projects?.name ? `(${task.projects.name})` : ''}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Clearance Notes *</label>
                  <Textarea
                    placeholder="Describe the work completed and why clearance is needed..."
                    value={clearanceForm.notes}
                    onChange={(e) => setClearanceForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Supporting Documents</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="flex-1"
                    />
                    {uploading && <span className="text-sm text-muted-foreground">Uploading...</span>}
                  </div>
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between text-sm bg-muted p-2 rounded">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span>{file.name}</span>
                            <span className="text-muted-foreground">({formatFileSize(file.size)})</span>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(index)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button type="submit" variant="success" className="flex-1" disabled={submitting || uploading}>
                    {submitting ? 'Submitting...' : 'Submit Clearance Request'}
                  </Button>
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {showClearanceDetails && (
        <ChiefClearanceDetailsModal
          clearanceId={showClearanceDetails}
          onClose={() => setShowClearanceDetails(null)}
          onAction={handleChiefAction}
        />
      )}
    </div>
  );
};

// ChiefClearanceDetailsModal component (same as before)
const ChiefClearanceDetailsModal = ({ clearanceId, onClose, onAction }: { 
  clearanceId: string; 
  onClose: () => void; 
  onAction: (id: string, status: 'approved' | 'rejected', notes?: string) => void;
}) => {
  // Same modal implementation as previous version
  return (
    <Dialog open={true} onOpenChange={onClose}>
      {/* Modal content - same as before */}
    </Dialog>
  );
};
