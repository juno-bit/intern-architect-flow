import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Upload, Plus, Edit2, Trash2, Calendar, User, AlertCircle, Table, Bell } from 'lucide-react';
import { toast } from 'sonner';
import TasksTable from '@/components/TasksTable';
import DeadlineAlertsTab from '@/components/DeadlineAlertsTab';
import { ProjectGallery } from '@/components/ProjectGallery';
import { EnhancedTaskAssignment } from '@/components/EnhancedTaskAssignment';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string;
  assigned_to: string;
  project_id?: string;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
  projects?: {
    name: string;
  };
}

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  start_date?: string;
  estimated_completion_date?: string;
  client_id?: string;
  clients?: {
    name: string;
  };
}

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
}

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    due_date: '',
    assigned_to: '',
    project_id: ''
  });
  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    start_date: '',
    estimated_completion_date: ''
  });
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/auth';
      return;
    }
    if (user) {
      fetchProfile();
      fetchTasks();
      fetchProjects();
      fetchTeamMembers();
    }
  }, [user, loading]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Error loading profile');
    }
  };

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          profiles:assigned_to (full_name, email),
          projects (name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks((data || []) as unknown as Task[]);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Error loading tasks');
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          clients (name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Error loading projects');
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('role', 'chief_architect')
        .order('full_name');

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('tasks')
        .insert({
          ...taskForm,
          created_by: user?.id
        });

      if (error) throw error;
      
      setShowTaskModal(false);
      setTaskForm({ title: '', description: '', priority: 'medium', due_date: '', assigned_to: '', project_id: '' });
      fetchTasks();
      toast.success('Task created successfully');
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Error creating task');
    }
  };

  const updateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update(taskForm)
        .eq('id', editingTask.id);

      if (error) throw error;
      
      setShowTaskModal(false);
      setEditingTask(null);
      setTaskForm({ title: '', description: '', priority: 'medium', due_date: '', assigned_to: '', project_id: '' });
      fetchTasks();
      toast.success('Task updated successfully');
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Error updating task');
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      
      fetchTasks();
      toast.success('Task deleted successfully');
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Error deleting task');
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;
      
      fetchTasks();
      toast.success('Task status updated');
    } catch (error) {
      console.error('Error updating task status:', error);
      toast.error('Error updating task status');
    }
  };

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('projects')
        .insert({
          ...projectForm,
          created_by: user?.id
        });

      if (error) throw error;
      
      setShowProjectModal(false);
      setEditingProject(null);
      setProjectForm({ name: '', description: '', start_date: '', estimated_completion_date: '' });
      fetchProjects();
      toast.success('Project created successfully');
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Error creating project');
    }
  };

  const updateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    try {
      const { error } = await supabase
        .from('projects')
        .update(projectForm)
        .eq('id', editingProject.id);

      if (error) throw error;
      
      setShowProjectModal(false);
      setEditingProject(null);
      setProjectForm({ name: '', description: '', start_date: '', estimated_completion_date: '' });
      fetchProjects();
      toast.success('Project updated successfully');
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('Error updating project');
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;
      
      fetchProjects();
      toast.success('Project deleted successfully');
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Error deleting project');
    }
  };

  const startEditProject = (project: Project) => {
    setEditingProject(project);
    setProjectForm({
      name: project.name,
      description: project.description || '',
      start_date: project.start_date || '',
      estimated_completion_date: project.estimated_completion_date || ''
    });
    setShowProjectModal(true);
  };

  const sendDeadlineNotifications = async () => {
    try {
      const { error } = await supabase.functions.invoke('deadline-notifications');
      if (error) throw error;
      toast.success('Deadline notifications sent successfully');
    } catch (error) {
      console.error('Error sending notifications:', error);
      toast.error('Error sending notifications');
    }
  };

  const startEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      due_date: task.due_date || '',
      assigned_to: task.assigned_to || '',
      project_id: task.project_id || ''
    });
    setShowTaskModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'overdue': return 'bg-red-500';
      default: return 'bg-yellow-500';
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

  const getRoleTitle = (role?: string) => {
    switch (role) {
      case 'chief_architect': return 'Chief Architect';
      case 'junior_architect': return 'Junior Architect';
      case 'intern': return 'Intern';
      default: return 'Team Member';
    }
  };

  const filteredTasks = profile?.role === 'chief_architect' 
    ? tasks 
    : tasks.filter(task => task.assigned_to === user?.id);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-foreground">
              {getRoleTitle(profile?.role)} Dashboard
            </h1>
            <Badge variant="outline">{profile?.full_name}</Badge>
          </div>
          <div className="flex items-center space-x-4">
            {profile?.role === 'chief_architect' && (
              <Button onClick={sendDeadlineNotifications} variant="outline">
                <AlertCircle className="h-4 w-4 mr-2" />
                Send Deadline Alerts
              </Button>
            )}
            <Button onClick={signOut} variant="destructive">
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <Tabs defaultValue="tasks" className="w-full">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="tasks">My Tasks</TabsTrigger>
            <TabsTrigger value="enhanced-tasks">Task Management</TabsTrigger>
            <TabsTrigger value="gallery">Gallery</TabsTrigger>
            {profile?.role === 'chief_architect' && (
              <>
                <TabsTrigger value="manage-tasks">Manage Tasks</TabsTrigger>
                <TabsTrigger value="all-tasks">All Tasks Table</TabsTrigger>
                <TabsTrigger value="projects">Projects</TabsTrigger>
                <TabsTrigger value="alerts">Deadline Alerts</TabsTrigger>
                <TabsTrigger value="reports">Reports</TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="tasks" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Your Assigned Tasks</h2>
              <Button onClick={() => window.location.href = '/gallery'} variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Upload Images
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTasks.map((task) => (
                <Card key={task.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{task.title}</CardTitle>
                      <div className="flex space-x-1">
                        <Badge className={`${getStatusColor(task.status)} text-white`}>
                          {task.status.replace('_', ' ')}
                        </Badge>
                        <Badge className={`${getPriorityColor(task.priority)} text-white`}>
                          {task.priority}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {task.description && (
                      <p className="text-muted-foreground text-sm">{task.description}</p>
                    )}
                    
                    <div className="space-y-2 text-sm">
                      {task.projects?.name && (
                        <div className="flex items-center text-muted-foreground">
                          <span className="font-medium">Project:</span>
                          <span className="ml-2">{task.projects.name}</span>
                        </div>
                      )}
                      
                      {task.due_date && (
                        <div className="flex items-center text-muted-foreground">
                          <Calendar className="h-4 w-4 mr-2" />
                          <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                        </div>
                      )}
                      
                      {task.profiles && (
                        <div className="flex items-center text-muted-foreground">
                          <User className="h-4 w-4 mr-2" />
                          <span>Assigned to: {task.profiles.full_name}</span>
                        </div>
                      )}
                    </div>

                    {profile?.role !== 'chief_architect' && task.assigned_to === user?.id && (
                      <div className="flex space-x-2 pt-2">
                        <Select value={task.status} onValueChange={(value) => updateTaskStatus(task.id, value as Task['status'])}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {profile?.role === 'chief_architect' && (
            <>
              <TabsContent value="manage-tasks" className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Task Management</h2>
                  <Button onClick={() => setShowTaskModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Task
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tasks.map((task) => (
                    <Card key={task.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg">{task.title}</CardTitle>
                          <div className="flex space-x-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEditTask(task)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteTask(task.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex space-x-2">
                          <Badge className={`${getStatusColor(task.status)} text-white`}>
                            {task.status.replace('_', ' ')}
                          </Badge>
                          <Badge className={`${getPriorityColor(task.priority)} text-white`}>
                            {task.priority}
                          </Badge>
                        </div>
                        
                        {task.description && (
                          <p className="text-muted-foreground text-sm">{task.description}</p>
                        )}
                        
                        <div className="space-y-2 text-sm">
                          {task.projects?.name && (
                            <div className="flex items-center text-muted-foreground">
                              <span className="font-medium">Project:</span>
                              <span className="ml-2">{task.projects.name}</span>
                            </div>
                          )}
                          
                          {task.due_date && (
                            <div className="flex items-center text-muted-foreground">
                              <Calendar className="h-4 w-4 mr-2" />
                              <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                            </div>
                          )}
                          
                          {task.profiles && (
                            <div className="flex items-center text-muted-foreground">
                              <User className="h-4 w-4 mr-2" />
                              <span>Assigned to: {task.profiles.full_name}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="all-tasks" className="space-y-6">
                <TasksTable 
                  tasks={tasks}
                  onEditTask={startEditTask}
                  onDeleteTask={deleteTask}
                  onUpdateStatus={updateTaskStatus}
                />
              </TabsContent>

              <TabsContent value="projects" className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Projects</h2>
                  <Button onClick={() => setShowProjectModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Project
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects.map((project) => (
                    <Card key={project.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <CardTitle>{project.name}</CardTitle>
                          <div className="flex space-x-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEditProject(project)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteProject(project.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {project.description && (
                          <p className="text-muted-foreground text-sm">{project.description}</p>
                        )}
                        
                        <div className="space-y-2 text-sm">
                          <Badge variant="outline">{project.status.replace('_', ' ')}</Badge>
                          
                          {project.clients?.name && (
                            <div className="flex items-center text-muted-foreground">
                              <span className="font-medium">Client:</span>
                              <span className="ml-2">{project.clients.name}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="alerts" className="space-y-6">
                <DeadlineAlertsTab userId={user?.id || ''} userRole={profile?.role || ''} />
              </TabsContent>

              <TabsContent value="reports" className="space-y-6">
                <h2 className="text-xl font-semibold">Progress Reports</h2>
                <Card>
                  <CardHeader>
                    <CardTitle>Team Performance Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-primary">
                          {tasks.filter(t => t.status === 'completed').length}
                        </div>
                        <p className="text-muted-foreground">Completed Tasks</p>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-yellow-500">
                          {tasks.filter(t => t.status === 'in_progress').length}
                        </div>
                        <p className="text-muted-foreground">In Progress</p>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-red-500">
                          {tasks.filter(t => t.status === 'overdue').length}
                        </div>
                        <p className="text-muted-foreground">Overdue Tasks</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </>
          )}
        </Tabs>

        {/* Task Modal */}
        <Dialog open={showTaskModal} onOpenChange={setShowTaskModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingTask ? 'Edit Task' : 'Create New Task'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={editingTask ? updateTask : createTask} className="space-y-4">
              <Input
                placeholder="Task title"
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                required
              />
              <Textarea
                placeholder="Task description"
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              />
              <Select
                value={taskForm.priority}
                onValueChange={(value) => setTaskForm({ ...taskForm, priority: value as any })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={taskForm.due_date}
                onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
              />
              <Select
                value={taskForm.assigned_to}
                onValueChange={(value) => setTaskForm({ ...taskForm, assigned_to: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Assign to" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.full_name} ({member.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={taskForm.project_id}
                onValueChange={(value) => setTaskForm({ ...taskForm, project_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex space-x-2">
                <Button type="submit" className="flex-1">
                  {editingTask ? 'Update Task' : 'Create Task'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowTaskModal(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Project Modal */}
        <Dialog open={showProjectModal} onOpenChange={setShowProjectModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingProject ? 'Edit Project' : 'Create New Project'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={editingProject ? updateProject : createProject} className="space-y-4">
              <Input
                placeholder="Project name"
                value={projectForm.name}
                onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                required
              />
              <Textarea
                placeholder="Project description"
                value={projectForm.description}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Input
                    type="date"
                    value={projectForm.start_date || ''}
                    onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Expected Completion</label>
                  <Input
                    type="date"
                    value={projectForm.estimated_completion_date || ''}
                    onChange={(e) => setProjectForm({ ...projectForm, estimated_completion_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex space-x-2">
                <Button type="submit" className="flex-1">
                  {editingProject ? 'Update Project' : 'Create Project'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowProjectModal(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}