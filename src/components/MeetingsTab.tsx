import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit2, Trash2, Calendar, Search, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Meeting {
  id: string;
  meeting_date: string;
  description: string;
  notes?: string;
  agenda?: string;
  attendees?: string[];
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

interface UserProfile {
  user_id: string;
  full_name: string;
  email: string;
}

interface MeetingsTabProps {
  userId: string;
  userRole: string;
}

export default function MeetingsTab({ userId, userRole }: MeetingsTabProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [currentUserName, setCurrentUserName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    meeting_date: '',
    meeting_time: '',
    description: '',
    agenda: '',
    notes: '',
    project_id: '',
    attendees: [] as string[]
  });

  useEffect(() => {
    fetchMeetings();
    fetchProjects();
    fetchUsers();
  }, []);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const { data: meetingsData, error: meetingsError } = await supabase
        .from('meetings')
        .select(`
          *,
          projects (name)
        `)
        .order('meeting_date', { ascending: false });

      if (meetingsError) throw meetingsError;

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p.full_name]) || []);

      const meetingsWithProfiles = (meetingsData || []).map(meeting => ({
        ...meeting,
        profiles: { full_name: profilesMap.get(meeting.created_by) || 'Unknown' }
      }));

      setMeetings(meetingsWithProfiles as unknown as Meeting[]);
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

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .order('full_name');

      if (error) throw error;
      setAvailableUsers(data || []);
      
      // Set current user name
      const currentUser = data?.find(u => u.user_id === userId);
      if (currentUser) {
        setCurrentUserName(currentUser.full_name);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const sendNotifications = async (attendeeIds: string[], meetingDateTime: string) => {
    const projectName = form.project_id 
      ? projects.find(p => p.id === form.project_id)?.name 
      : undefined;

    for (const attendeeId of attendeeIds) {
      const attendee = availableUsers.find(u => u.user_id === attendeeId);
      if (!attendee?.email) continue;

      // Create in-app notification
      try {
        await supabase.from('notifications').insert({
          user_id: attendeeId,
          title: 'Meeting Invitation',
          message: `You have been added to meeting: ${form.description}`,
          type: 'deadline_reminder'
        });
      } catch (error) {
        console.error('Error creating notification:', error);
      }

      // Send email notification
      try {
        await supabase.functions.invoke('send-meeting-notification', {
          body: {
            to: attendee.email,
            toName: attendee.full_name,
            meetingDate: meetingDateTime,
            description: form.description,
            agenda: form.agenda || undefined,
            projectName,
            creatorName: currentUserName
          }
        });
      } catch (error) {
        console.error('Error sending email notification:', error);
      }
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
      agenda: form.agenda || null,
      notes: form.notes || null,
      attendees: form.attendees.length > 0 ? form.attendees : null,
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
        
        // Send notifications to newly added attendees
        const previousAttendees = editingMeeting.attendees || [];
        const newAttendees = form.attendees.filter(id => !previousAttendees.includes(id));
        if (newAttendees.length > 0) {
          await sendNotifications(newAttendees, meetingDateTime);
          toast.success(`Meeting updated and ${newAttendees.length} notification(s) sent`);
        } else {
          toast.success('Meeting updated successfully');
        }
      } else {
        const { error } = await supabase
          .from('meetings')
          .insert(payload);

        if (error) throw error;
        
        // Send notifications to all attendees
        if (form.attendees.length > 0) {
          await sendNotifications(form.attendees, meetingDateTime);
          toast.success(`Meeting created and ${form.attendees.length} notification(s) sent`);
        } else {
          toast.success('Meeting created successfully');
        }
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
      agenda: meeting.agenda || '',
      notes: meeting.notes || '',
      project_id: meeting.project_id || '',
      attendees: meeting.attendees || []
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
      agenda: '',
      notes: '',
      project_id: '',
      attendees: []
    });
  };

  const canManageMeeting = (meeting: Meeting) => {
    return userRole === 'chief_architect' || meeting.created_by === userId;
  };

  const toggleAttendee = (attendeeId: string) => {
    if (form.attendees.includes(attendeeId)) {
      setForm({ ...form, attendees: form.attendees.filter(id => id !== attendeeId) });
    } else {
      setForm({ ...form, attendees: [...form.attendees, attendeeId] });
    }
  };

  const getAttendeeName = (attendeeId: string) => {
    return availableUsers.find(u => u.user_id === attendeeId)?.full_name || 'Unknown';
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
            {userRole !== 'intern' && (
              <Button onClick={() => setShowModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Meeting
              </Button>
            )}
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
                        
                        {meeting.agenda && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-muted-foreground">Agenda:</p>
                            <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/50 p-2 rounded-md mt-1">{meeting.agenda}</p>
                          </div>
                        )}
                        
                        {meeting.notes && (
                          <p className="text-sm text-muted-foreground">{meeting.notes}</p>
                        )}
                        
                        {meeting.attendees && meeting.attendees.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap mt-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {meeting.attendees.map(attendeeId => (
                              <Badge key={attendeeId} variant="outline" className="text-xs">
                                {getAttendeeName(attendeeId)}
                              </Badge>
                            ))}
                          </div>
                        )}
                        
                        <p className="text-xs text-muted-foreground">
                          Recorded by: {meeting.profiles?.full_name || 'Unknown'}
                        </p>
                      </div>
                      {userRole !== 'intern' && canManageMeeting(meeting) && (
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
        <DialogContent className="bg-card border border-border max-h-[90vh] overflow-y-auto">
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
              <label className="text-sm font-medium text-foreground">Agenda (Optional)</label>
              <Textarea
                value={form.agenda}
                onChange={(e) => setForm({ ...form, agenda: e.target.value })}
                placeholder="Meeting agenda items..."
                rows={3}
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
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Tag Attendees (will receive email notification)
              </label>
              <div className="border border-border rounded-md p-3 max-h-40 overflow-y-auto space-y-2 mt-1 bg-background">
                {availableUsers.filter(u => u.user_id !== userId).map(user => (
                  <div key={user.user_id} className="flex items-center gap-2">
                    <Checkbox
                      id={`user-${user.user_id}`}
                      checked={form.attendees.includes(user.user_id)}
                      onCheckedChange={() => toggleAttendee(user.user_id)}
                    />
                    <label 
                      htmlFor={`user-${user.user_id}`} 
                      className="text-sm cursor-pointer flex-1"
                    >
                      {user.full_name}
                      <span className="text-muted-foreground text-xs ml-2">({user.email})</span>
                    </label>
                  </div>
                ))}
                {availableUsers.filter(u => u.user_id !== userId).length === 0 && (
                  <p className="text-sm text-muted-foreground">No other users available</p>
                )}
              </div>
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
