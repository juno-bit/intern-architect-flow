import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Clock, FolderOpen, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface WorklogTabProps {
  userId: string;
  userRole: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  projects?: { name: string } | null;
}

interface Project {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  estimated_completion_date: string | null;
  description: string | null;
  project_type: string | null;
}

export default function WorklogTab({ userId, userRole }: WorklogTabProps) {
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [remainingProjects, setRemainingProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorklogData();
  }, [userId]);

  const fetchWorklogData = async () => {
    setLoading(true);
    try {
      const [tasksRes, projectsRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('*, projects(name)')
          .eq('assigned_to', userId)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false }),
        supabase
          .from('projects')
          .select('*')
          .in('status', ['planning', 'in_progress', 'on_hold'])
          .order('estimated_completion_date', { ascending: true })
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (projectsRes.error) throw projectsRes.error;

      setCompletedTasks((tasksRes.data || []) as unknown as Task[]);
      setRemainingProjects(projectsRes.data || []);
    } catch (error) {
      console.error('Error fetching worklog data:', error);
      toast.error('Error loading worklog');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  const getProjectStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress': return 'bg-blue-500';
      case 'on_hold': return 'bg-yellow-500';
      default: return 'bg-muted';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-foreground">{completedTasks.length}</p>
                <p className="text-sm text-muted-foreground">Completed Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FolderOpen className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-foreground">{remainingProjects.length}</p>
                <p className="text-sm text-muted-foreground">Active Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {remainingProjects.filter(p => p.status === 'in_progress').length}
                </p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="completed-tasks">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="completed-tasks">Completed Tasks</TabsTrigger>
          <TabsTrigger value="remaining-projects">Remaining Projects</TabsTrigger>
        </TabsList>

        <TabsContent value="completed-tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Completed Tasks ({completedTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Completed On</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedTasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell>
                          <div>
                            <div className="font-semibold">{task.title}</div>
                            {task.description && (
                              <div className="text-sm text-muted-foreground line-clamp-1">
                                {task.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{task.projects?.name || 'No Project'}</TableCell>
                        <TableCell>
                          <Badge className={`${getPriorityColor(task.priority)} text-white`}>
                            {task.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {task.completed_at
                              ? new Date(task.completed_at).toLocaleDateString()
                              : 'N/A'}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {completedTasks.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No completed tasks yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="remaining-projects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-blue-500" />
                Remaining Projects ({remainingProjects.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Est. Completion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {remainingProjects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell>
                          <div>
                            <div className="font-semibold">{project.name}</div>
                            {project.description && (
                              <div className="text-sm text-muted-foreground line-clamp-1">
                                {project.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="capitalize text-sm">
                            {project.project_type?.replace('_', ' ') || 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getProjectStatusColor(project.status)} text-white`}>
                            {project.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {project.start_date
                            ? new Date(project.start_date).toLocaleDateString()
                            : 'Not set'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {project.estimated_completion_date
                              ? new Date(project.estimated_completion_date).toLocaleDateString()
                              : 'Not set'}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {remainingProjects.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    All projects completed! 🎉
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
