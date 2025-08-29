import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
      const userTasks = allTasks.filter((task: Task) => 
        task.assignee.toLowerCase().replace('_', ' ') === profile.role.toLowerCase().replace('_', ' ')
      );
      setTasks(userTasks);
    } else {
      setTasks(allTasks);
    }
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

      <section className="text-center mb-8">
        <Button 
          onClick={() => navigate('/gallery')} 
          variant="outline"
          className="text-accent border-accent hover:bg-accent hover:text-background text-lg px-6 py-3"
        >
          Upload Images
        </Button>
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
                <div>
                  <div className="font-bold text-lg mb-1">{task.title}</div>
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
    </div>
  );
}