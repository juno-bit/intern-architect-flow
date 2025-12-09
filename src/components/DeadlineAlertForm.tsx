import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Send, Calendar, User, FolderOpen, Mail } from 'lucide-react';

interface Project {
  id: string;
  name: string;
}

interface User {
  user_id: string;
  full_name: string;
  role: string;
  email: string;
}

interface Task {
  id: string;
  title: string;
  due_date: string;
  assigned_to: string;
  project_id?: string;
}

interface DeadlineAlertFormProps {
  userId: string;
  userRole: string;
}

export default function DeadlineAlertForm({ userId, userRole }: DeadlineAlertFormProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [alertForm, setAlertForm] = useState({
    project_id: '',
    task_id: '',
    assignee_id: '',
    due_date: '',
    message: '',
    custom_task_name: '',
    use_existing_task: true
  });

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    try {
      // Fetch projects
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');

      // Fetch users WITH EMAIL
      const { data: usersData } = await supabase
        .from('profiles')
        .select('user_id, full_name, role, email')
        .order('full_name');

      // Fetch tasks
      const { data: tasksData } = await supabase
        .from('tasks')
        .select(`
          id, 
          title, 
          due_date, 
          assigned_to,
          project_id
        `)
        .in('status', ['pending', 'in_progress'])
        .order('due_date');

      setProjects(projectsData || []);
      setUsers(usersData || []);
      setTasks(tasksData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error loading form data');
    }
  };

  const filteredTasks = tasks.filter(task => 
    (!alertForm.project_id || task.project_id === alertForm.project_id) &&
    (!alertForm.assignee_id || task.assigned_to === alertForm.assignee_id)
  );

  const sendCustomAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!alertForm.assignee_id || !alertForm.due_date) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSending(true);
      
      const taskName = alertForm.use_existing_task 
        ? tasks.find(t => t.id === alertForm.task_id)?.title 
        : alertForm.custom_task_name;

      const projectName = projects.find(p => p.id === alertForm.project_id)?.name;
      const assignee = users.find(u => u.user_id === alertForm.assignee_id);
      const assigneeName = assignee?.full_name;
      const assigneeEmail = assignee?.email;

      if (!assigneeEmail) {
        toast.error('Assignee email not found');
        return;
      }

      const notificationMessage = alertForm.message || 
        `🚨 Deadline Reminder: ${taskName} is due on ${new Date(alertForm.due_date).toLocaleDateString()}${projectName ? ` for project ${projectName}` : ''}`;

      // 1. Create notification in database
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: alertForm.assignee_id,
          title: 'Deadline Alert - Email Sent',
          message: notificationMessage,
          type: 'deadline_reminder',
          task_id: alertForm.use_existing_task ? alertForm.task_id : null,
          sent_at: new Date().toISOString()
        });

      if (notificationError) throw notificationError;

      // 2. Send DIRECT EMAIL via Supabase Edge Function
      const { data: emailData, error: emailError } = await supabase.functions.invoke(
        'send-deadline-email',
        {
          body: {
            to: assigneeEmail,
            toName: assigneeName,
            subject: '🚨 Deadline Alert - Action Required',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #dc2626;">Deadline Alert!</h2>
                <p><strong>Task:</strong> ${taskName}</p>
                <p><strong>Due Date:</strong> ${new Date(alertForm.due_date).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
                ${projectName ? `<p><strong>Project:</strong> ${projectName}</p>` : ''}
                <p><strong>Message:</strong><br>${notificationMessage}</p>
                <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="color: #92400e; margin: 0;"><strong>⚠️ This task is approaching its deadline!</strong></p>
                </div>
                <p style="color: #6b7280; font-size: 14px;">
                  This is an automated reminder from the project management system.
                </p>
              </div>
            `,
            text: `Deadline Alert!

Task: ${taskName}
Due Date: ${new Date(alertForm.due_date).toLocaleDateString()}
Project: ${projectName || 'N/A'}
Message: ${notificationMessage}

⚠️ This task is approaching its deadline!`,
            task_name: taskName,
            due_date: alertForm.due_date,
            project_name: projectName
          }
        }
      );

      if (emailError) {
        console.error('Email sending error:', emailError);
        toast.warning('Alert created but email failed to send');
      } else {
        console.log('✅ Email sent successfully to:', assigneeEmail, emailData);
        toast.success(`✅ Email sent to ${assigneeName} (${assigneeEmail})`);
      }

      // Reset form
      setAlertForm({
        project_id: '',
        task_id: '',
        assignee_id: '',
        due_date: '',
        message: '',
        custom_task_name: '',
        use_existing_task: true
      });
      setShowForm(false);
    } catch (error) {
      console.error('Error sending alert:', error);
      toast.error('Failed to send alert');
    } finally {
      setSending(false);
    }
  };

  // ✅ CHIEF ARCHITECT ONLY ACCESS RESTORED
  if (userRole !== 'chief_architect') {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          <Mail className="h-5 w-5 text-blue-500" />
          Chief Architect: Send Email Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button variant="success" size="lg" className="w-full">
              <Send className="h-4 w-4 mr-2" />
              Send Email Alert
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Send Deadline Alert via Email</DialogTitle>
            </DialogHeader>
            <form onSubmit={sendCustomAlert} className="space-y-4">
              <Select
                value={alertForm.project_id}
                onValueChange={(value) => setAlertForm({ ...alertForm, project_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project (optional)" />
                </SelectTrigger>
                <SelectContent>
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

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="existing-task"
                    checked={alertForm.use_existing_task}
                    onChange={() => setAlertForm({ ...alertForm, use_existing_task: true })}
                  />
                  <label htmlFor="existing-task">Use existing task</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="custom-task"
                    checked={!alertForm.use_existing_task}
                    onChange={() => setAlertForm({ ...alertForm, use_existing_task: false })}
                  />
                  <label htmlFor="custom-task">Custom task name</label>
                </div>
              </div>

              {alertForm.use_existing_task ? (
                <Select
                  value={alertForm.task_id}
                  onValueChange={(value) => setAlertForm({ ...alertForm, task_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select task" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="Enter task name"
                  value={alertForm.custom_task_name}
                  onChange={(e) => setAlertForm({ ...alertForm, custom_task_name: e.target.value })}
                  required={!alertForm.use_existing_task}
                />
              )}

              <Select
                value={alertForm.assignee_id}
                onValueChange={(value) => setAlertForm({ ...alertForm, assignee_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee *" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {user.full_name} ({user.role})
                        {user.email && (
                          <span className="text-xs text-muted-foreground ml-2">• {user.email}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Due Date *
                </label>
                <Input
                  type="date"
                  value={alertForm.due_date}
                  onChange={(e) => setAlertForm({ ...alertForm, due_date: e.target.value })}
                  required
                />
              </div>

              <Textarea
                placeholder="Custom message (optional)"
                value={alertForm.message}
                onChange={(e) => setAlertForm({ ...alertForm, message: e.target.value })}
                rows={3}
              />

              <div className="flex space-x-2">
                <Button type="submit" variant="success" size="lg" className="flex-1" disabled={sending}>
                  {sending ? 'Sending Email...' : 'Send Email Alert'}
                </Button>
                <Button type="button" variant="outline" size="lg" onClick={() => setShowForm(false)}>
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
