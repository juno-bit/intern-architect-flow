import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertTriangle, Bell, Calendar, Clock, Send, CheckCircle, XCircle } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
  sent_at: string | null;
  is_read: boolean;
  task_id?: string;
  tasks?: {
    title: string;
    due_date: string;
    status: string;
  };
}

interface Task {
  id: string;
  title: string;
  due_date: string;
  status: string;
  priority: string;
  profiles?: {
    full_name: string;
    email: string;
  };
  projects?: {
    name: string;
  };
}

interface DeadlineAlertsTabProps {
  userId: string;
  userRole: string;
}

export default function DeadlineAlertsTab({ userId, userRole }: DeadlineAlertsTabProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchNotifications();
    fetchDeadlineTasks();
  }, [userId]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          tasks (title, due_date, status)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Error loading notifications');
    }
  };

  const fetchDeadlineTasks = async () => {
    try {
      setLoading(true);
      
      const today = new Date();
      const twoDaysFromNow = new Date();
      twoDaysFromNow.setDate(today.getDate() + 2);

      // Fetch overdue tasks
      const { data: overdueData, error: overdueError } = await supabase
        .from('tasks')
        .select(`
          *,
          profiles:assigned_to (full_name, email),
          projects (name)
        `)
        .lt('due_date', today.toISOString().split('T')[0])
        .in('status', ['pending', 'in_progress'])
        .not('assigned_to', 'is', null);

      if (overdueError) throw overdueError;

      // Fetch upcoming tasks (due within 2 days)
      const { data: upcomingData, error: upcomingError } = await supabase
        .from('tasks')
        .select(`
          *,
          profiles:assigned_to (full_name, email),
          projects (name)
        `)
        .gte('due_date', today.toISOString().split('T')[0])
        .lte('due_date', twoDaysFromNow.toISOString().split('T')[0])
        .in('status', ['pending', 'in_progress'])
        .not('assigned_to', 'is', null);

      if (upcomingError) throw upcomingError;

      setOverdueTasks((overdueData || []) as unknown as Task[]);
      setUpcomingTasks((upcomingData || []) as unknown as Task[]);
    } catch (error) {
      console.error('Error fetching deadline tasks:', error);
      toast.error('Error loading deadline tasks');
    } finally {
      setLoading(false);
    }
  };

  const sendDeadlineNotifications = async () => {
    try {
      setSending(true);
      const { data, error } = await supabase.functions.invoke('deadline-notifications');
      
      if (error) throw error;
      
      toast.success(`Deadline notifications sent successfully`);
      fetchNotifications();
      fetchDeadlineTasks();
    } catch (error) {
      console.error('Error sending notifications:', error);
      toast.error('Error sending notifications');
    } finally {
      setSending(false);
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
      
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, is_read: true }
            : notif
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const getTaskUrgency = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / (1000 * 3600 * 24));
    
    if (daysUntilDue < 0) return { label: 'OVERDUE', color: 'bg-red-500', days: Math.abs(daysUntilDue) };
    if (daysUntilDue === 0) return { label: 'DUE TODAY', color: 'bg-red-400', days: 0 };
    if (daysUntilDue === 1) return { label: 'DUE TOMORROW', color: 'bg-orange-500', days: 1 };
    return { label: `${daysUntilDue} DAYS LEFT`, color: 'bg-yellow-500', days: daysUntilDue };
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  const unreadNotifications = notifications.filter(n => !n.is_read);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with send notifications button */}
      {userRole === 'chief_architect' && (
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Deadline Alerts & Notifications</h2>
          <Button 
            onClick={sendDeadlineNotifications} 
            disabled={sending}
            className="bg-primary hover:bg-primary/90"
          >
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'Sending...' : 'Send Deadline Alerts'}
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{overdueTasks.length}</div>
                <div className="text-sm text-muted-foreground">Overdue Tasks</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{upcomingTasks.length}</div>
                <div className="text-sm text-muted-foreground">Due Soon (2 days)</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Bell className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{unreadNotifications.length}</div>
                <div className="text-sm text-muted-foreground">Unread Notifications</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Tasks */}
      {overdueTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Overdue Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {overdueTasks.map((task) => {
                const urgency = getTaskUrgency(task.due_date);
                return (
                  <div key={task.id} className="border border-red-200 rounded-lg p-4 bg-red-50/50 dark:bg-red-900/10">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold text-red-800 dark:text-red-200">{task.title}</h4>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span>Assigned to: {task.profiles?.full_name}</span>
                          {task.projects?.name && <span>Project: {task.projects.name}</span>}
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={`${getPriorityColor(task.priority)} text-white`}>
                          {task.priority}
                        </Badge>
                        <Badge className={`${urgency.color} text-white`}>
                          {urgency.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Tasks */}
      {upcomingTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <Clock className="h-5 w-5" />
              Tasks Due Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingTasks.map((task) => {
                const urgency = getTaskUrgency(task.due_date);
                return (
                  <div key={task.id} className="border border-yellow-200 rounded-lg p-4 bg-yellow-50/50 dark:bg-yellow-900/10">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">{task.title}</h4>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span>Assigned to: {task.profiles?.full_name}</span>
                          {task.projects?.name && <span>Project: {task.projects.name}</span>}
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={`${getPriorityColor(task.priority)} text-white`}>
                          {task.priority}
                        </Badge>
                        <Badge className={`${urgency.color} text-white`}>
                          {urgency.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Recent Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          {notifications.length > 0 ? (
            <div className="space-y-3">
              {notifications.slice(0, 10).map((notification) => (
                <div 
                  key={notification.id} 
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    notification.is_read 
                      ? 'bg-muted/20 border-border' 
                      : 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200'
                  }`}
                  onClick={() => !notification.is_read && markNotificationAsRead(notification.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{notification.title}</h4>
                        {!notification.is_read && (
                          <Badge variant="default" className="bg-blue-500">New</Badge>
                        )}
                        {notification.sent_at ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Created: {new Date(notification.created_at).toLocaleString()}</span>
                        {notification.sent_at && (
                          <span>Sent: {new Date(notification.sent_at).toLocaleString()}</span>
                        )}
                        {notification.tasks && (
                          <span>Task: {notification.tasks.title}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No notifications yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}