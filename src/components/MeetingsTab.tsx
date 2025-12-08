import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2, Calendar, Search, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Meeting {
  id: string;
  meeting_date: string;
  description: string;
  notes?: string;
  project_id?: string;
  created_by: string;
  created_at: string;
  projects?: {
    name: string;
  };
  profiles?: {
    full_name: string;
  };
}

interface Project {
  id: string;
  name: string;
}

interface MeetingsTabProps {
  userId: string;
  userRole: string;
}

export default function MeetingsTab({ userId, userRole }: MeetingsTabProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    meeting_date: '',
    meeting_time: '',
    description: '',
    notes: '',
    project_id: ''
  });

  useEffect(() => {
    fetchMeetings();
    fetchProjects();
  }, []);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('meetings')
        .select(`
          *,
          projects (name),
          profiles:created_by (full_name)
        `)
        .order('meeting_date', { ascending: false });

      if (error) throw error;
      setMeetings((data || []) as unknown as Meeting[]);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      toast.error('Error loading meetings');
    } finally {
      setLoading(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const meetingDateTime = form.meeting_date && form.meeting_time
      ? `${form.meeting_date}T${form.meeting_time}:00`
      : form.meeting_date;

    const payload = {
      meeting_date: meetingDateTime,
      description: form.description,
      notes: form.notes || null,
      project_id: form.project_id || null,
      created_by: userId
    };

    try {
      if (editingMeeting) {
        const { error } = await supabase
          .from('meetings')
          .update(payload)
          .eq('id', editingMeeting.id);

        if (error) throw error;
        toast.success('Meeting updated successfully');
      } else {
        const { error } = await supabase
          .from('meetings')
          .insert(payload);

        if (error) throw error;
        toast.success('Meeting created successfully');
      }

      resetForm();
      fetchMeetings();
    } catch (error) {
      console.error('Error saving meeting:', error);
      toast.error('Error saving meeting');
    }
  };

  const deleteMeeting = async (meetingId: string) => {
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId);

      if (error) throw error;
      toast.success('Meeting deleted successfully');
      fetchMeetings();
    } catch (error) {
      console.error('Error deleting meeting:', error);
      toast.error('Error deleting meeting');
    }
  };

  const startEdit = (meeting: Meeting) => {
    const meetingDate = new Date(meeting.meeting_date);
    setEditingMeeting(meeting);
    setForm({
      meeting_date: format(meetingDate, 'yyyy-MM-dd'),
      meeting_time: format(meetingDate, 'HH:mm'),
      description: meeting.description,
      notes: meeting.notes || '',
      project_id: meeting.project_id || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setShowModal(false);
    setEditingMeeting(null);
    setForm({
      meeting_date: '',
      meeting_time: '',
      description: '',
      notes: '',
      project_id: ''
    });
  };

  const canManageMeeting = (meeting: Meeting) => {
    return userRole === 'chief_architect' || meeting.created_by === userId;
  };

  const filteredMeetings = meetings.filter(meeting => {
    const matchesSearch = searchQuery === '' || 
      meeting.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meeting.projects?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesProject = projectFilter === '' || projectFilter === 'all' || meeting.project_id === projectFilter;
    
    return matchesSearch && matchesProject;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Meeting Records
            </CardTitle>
            <Button onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Meeting
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search meetings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by project" />
              </SelectTrigger>
              <SelectContent className="bg-card border border-border">
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredMeetings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No meetings found</p>
              <p className="text-sm">Click "Add Meeting" to record a new meeting</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMeetings.map(meeting => (
                <Card key={meeting.id} className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(meeting.meeting_date), 'PPP p')}
                          </Badge>
                          {meeting.projects?.name && (
                            <Badge variant="secondary">
                              {meeting.projects.name}
                            </Badge>
                          )}
                        </div>
                        <p className="text-foreground font-medium">{meeting.description}</p>
                        {meeting.notes && (
                          <p className="text-sm text-muted-foreground">{meeting.notes}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Recorded by: {meeting.profiles?.full_name || 'Unknown'}
                        </p>
                      </div>
                      {canManageMeeting(meeting) && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEdit(meeting)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteMeeting(meeting.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="bg-card border border-border">
          <DialogHeader>
            <DialogTitle>
              {editingMeeting ? 'Edit Meeting' : 'Add Meeting'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">Date *</label>
                <Input
                  type="date"
                  value={form.meeting_date}
                  onChange={(e) => setForm({ ...form, meeting_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Time *</label>
                <Input
                  type="time"
                  value={form.meeting_time}
                  onChange={(e) => setForm({ ...form, meeting_time: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Description *</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of the meeting..."
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Project (Optional)</label>
              <Select value={form.project_id || "none"} onValueChange={(value) => setForm({ ...form, project_id: value === "none" ? "" : value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent className="bg-card border border-border">
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Notes (Optional)</label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit">
                {editingMeeting ? 'Update Meeting' : 'Create Meeting'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}