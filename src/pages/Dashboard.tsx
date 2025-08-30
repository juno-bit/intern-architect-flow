import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Task {
  id: number;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  dueDate: string;
  assignee: string;
}

interface Profile {
  role: string;
  full_name: string;
}

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'high' | 'medium' | 'low',
    dueDate: '',
    assignee: 'intern'
  });
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      loadTasks();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('user_id', user.id)
      .single();

    if (data) {
      setProfile(data);
    }
  };

  const loadTasks = () => {
    const defaultTasks = [
      {
        id: 1,
        title: 'Ambara House - Final Drawings',
        description: 'Complete architectural drawings for Ambara House project.',
        priority: 'high' as const,
        dueDate: '2025-09-15',
        assignee: 'chief_architect'
      },
      {
        id: 2,
        title: 'Material Sourcing - Reclaimed Wood',
        description: 'Source sustainable reclaimed wood for interior paneling.',
        priority: 'medium' as const,
        dueDate: '2025-09-20',
        assignee: 'intern'
      },
      {
        id: 3,
        title: 'Site Visit - Kota Stone Installation',
        description: 'Supervise Kota stone installation at the site.',
        priority: 'medium' as const,
        dueDate: '2025-09-25',
        assignee: 'chief_architect'
      },
      {
        id: 4,
        title: '3D Model - Client Presentation',
        description: 'Prepare 3D model renderings for client meeting.',
        priority: 'high' as const,
        dueDate: '2025-09-18',
        assignee: 'junior_architect'
      },
      {
        id: 5,
        title: 'Landscape Plan Review',
        description: 'Review and provide feedback on landscape design drafts.',
        priority: 'low' as const,
        dueDate: '2025-09-30',
        assignee: 'junior_architect'
      }
    ];

    const savedTasks = localStorage.getItem('tasks');
    const allTasks = savedTasks ? JSON.parse(savedTasks) : defaultTasks;
    
    if (profile?.role) {
      // Fix task filtering by exact role match
      const userTasks = allTasks.filter((task: Task) => 
        task.assignee === profile.role
      );
      setTasks(userTasks);
    } else {
      // Only show all tasks for chief architect
      if (profile?.role === 'chief_architect') {
        setTasks(allTasks);
      } else {
        setTasks([]);
      }
    }
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim() || !newTask.description.trim()) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    const savedTasks = localStorage.getItem('tasks');
    const existingTasks = savedTasks ? JSON.parse(savedTasks) : [];
    
    const newTaskWithId = {
      ...newTask,
      id: Math.max(...existingTasks.map((t: Task) => t.id), 0) + 1,
    };

    const updatedTasks = [...existingTasks, newTaskWithId];
    localStorage.setItem('tasks', JSON.stringify(updatedTasks));
    
    toast({
      title: 'Success',
      description: 'Task created successfully!',
    });

    // Reset form and close modal
    setNewTask({
      title: '',
      description: '',
      priority: 'medium',
      dueDate: '',
      assignee: 'intern'
    });
    setShowCreateTask(false);
    
    // Reload tasks
    loadTasks();
  };

  const updateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !newTask.title.trim() || !newTask.description.trim()) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    const savedTasks = localStorage.getItem('tasks');
    const existingTasks = savedTasks ? JSON.parse(savedTasks) : [];
    
    const updatedTasks = existingTasks.map((task: Task) =>
      task.id === editingTask.id ? { ...newTask, id: editingTask.id } : task
    );
    localStorage.setItem('tasks', JSON.stringify(updatedTasks));
    
    toast({
      title: 'Success',
      description: 'Task updated successfully!',
    });

    // Reset form and close modal
    setNewTask({
      title: '',
      description: '',
      priority: 'medium',
      dueDate: '',
      assignee: 'intern'
    });
    setEditingTask(null);
    
    // Reload tasks
    loadTasks();
  };

  const deleteTask = (taskId: number) => {
    const savedTasks = localStorage.getItem('tasks');
    const existingTasks = savedTasks ? JSON.parse(savedTasks) : [];
    
    const updatedTasks = existingTasks.filter((task: Task) => task.id !== taskId);
    localStorage.setItem('tasks', JSON.stringify(updatedTasks));
    
    toast({
      title: 'Success',
      description: 'Task deleted successfully!',
    });
    
    // Reload tasks
    loadTasks();
  };

  const startEditTask = (task: Task) => {
    setEditingTask(task);
    setNewTask({
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate,
      assignee: task.assignee
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-600';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-600';
      default: return 'bg-gray-500';
    }
  };

  const getRoleTitle = (role?: string) => {
    switch (role) {
      case 'chief_architect': return 'Chief Architect Dashboard';
      case 'junior_architect': return 'Junior Architect Dashboard';
      case 'intern': return 'Intern Dashboard';
      default: return 'Dashboard';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-xl text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 flex flex-col">
      <header className="flex justify-between items-center mb-8">
        <nav className="order-first">
          <Button 
            onClick={() => navigate('/')} 
            variant="outline"
            className="text-accent border-accent hover:bg-accent hover:text-background"
          >
            Home
          </Button>
        </nav>
        
        <h1 className="text-3xl font-bold flex-grow text-center text-primary-foreground">
          Wright Inspires - {getRoleTitle(profile?.role)}
        </h1>
        
        <nav className="order-last">
          <Button 
            onClick={signOut} 
            variant="outline"
            className="text-accent border-accent hover:bg-accent hover:text-background"
          >
            Logout
          </Button>
        </nav>
      </header>

      <section className="text-center mb-8 space-x-4">
        <Button 
          onClick={() => navigate('/gallery')} 
          variant="outline"
          className="text-accent border-accent hover:bg-accent hover:text-background text-lg px-6 py-3"
        >
          Upload Images
        </Button>
        
        {profile?.role === 'chief_architect' && (
          <Button 
            onClick={() => setShowCreateTask(true)} 
            variant="outline"
            className="text-accent border-accent hover:bg-accent hover:text-background text-lg px-6 py-3"
          >
            Create Task
          </Button>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4 text-primary-foreground">
          Your Assigned Tasks
        </h2>
        
        {tasks.length === 0 ? (
          <p className="text-center text-lg text-primary-foreground">
            No tasks assigned to you yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="bg-white text-green-800 rounded-xl p-4 shadow-lg min-h-32 flex flex-col justify-between relative"
              >
                {profile?.role === 'chief_architect' && (
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEditTask(task)}
                      className="h-6 w-6 p-0 text-xs"
                    >
                      ✏️
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteTask(task.id)}
                      className="h-6 w-6 p-0 text-xs"
                    >
                      🗑️
                    </Button>
                  </div>
                )}
                
                <div>
                  <div className="font-bold text-lg mb-1 pr-16">{task.title}</div>
                  <div className="text-sm mb-3">{task.description}</div>
                </div>
                
                <div>
                  <span
                    className={`${getPriorityColor(task.priority)} text-white px-2 py-1 rounded-full text-xs font-bold inline-block mb-2`}
                  >
                    {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
                  </span>
                  
                  <div className="text-sm">
                    Due: <strong>{task.dueDate || 'None'}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create/Edit Task Modal */}
      {(showCreateTask || editingTask) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-card">
            <CardHeader>
              <CardTitle>{editingTask ? 'Edit Task' : 'Create New Task'}</CardTitle>
              <CardDescription>
                {editingTask ? 'Update task details' : 'Assign a new task to team members'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={editingTask ? updateTask : createTask} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="taskTitle">Task Title</Label>
                  <Input
                    id="taskTitle"
                    type="text"
                    placeholder="Enter task title"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="taskDescription">Description</Label>
                  <Input
                    id="taskDescription"
                    type="text"
                    placeholder="Enter task description"
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="taskPriority">Priority</Label>
                  <Select value={newTask.priority} onValueChange={(value: any) => setNewTask({ ...newTask, priority: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="taskDueDate">Due Date</Label>
                  <Input
                    id="taskDueDate"
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="taskAssignee">Assign To</Label>
                  <Select value={newTask.assignee} onValueChange={(value: any) => setNewTask({ ...newTask, assignee: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intern">Intern</SelectItem>
                      <SelectItem value="junior_architect">Junior Architect</SelectItem>
                      <SelectItem value="chief_architect">Chief Architect</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1">
                    {editingTask ? 'Update Task' : 'Create Task'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowCreateTask(false);
                      setEditingTask(null);
                      setNewTask({
                        title: '',
                        description: '',
                        priority: 'medium',
                        dueDate: '',
                        assignee: 'intern'
                      });
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}