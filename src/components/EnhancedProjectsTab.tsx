import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Calendar, 
  CheckCircle2, 
  Image as ImageIcon,
  Search,
  Folder
} from 'lucide-react';
import { toast } from 'sonner';

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  start_date?: string;
  estimated_completion_date?: string;
  phase?: string;
  clients?: {
    name: string;
  };
}

interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  totalImages: number;
}

interface EnhancedProjectsTabProps {
  userId: string;
  userRole: string;
  onEditProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
  onCreateProject: () => void;
}

export default function EnhancedProjectsTab({
  userId,
  userRole,
  onEditProject,
  onDeleteProject,
  onCreateProject
}: EnhancedProjectsTabProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectStats, setProjectStats] = useState<Record<string, ProjectStats>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      let query = supabase
        .from('projects')
        .select(`
          *,
          clients (name)
        `)
        .order('created_at', { ascending: false });

      let data;
      let error;

      // Filter based on user role
      if (userRole === 'chief_architect') {
        // Chief architects see all projects
        ({ data, error } = await query);
      } else {
        // Non-chief architects: filter by projects they're involved in via tasks
        const { data: userTasks, error: tasksError } = await supabase
          .from('tasks')
          .select('project_id')
          .or(`assigned_to.eq.${userId},created_by.eq.${userId}`);

        if (tasksError) throw tasksError;

        const projectIds = [...new Set(userTasks?.map(t => t.project_id).filter(Boolean))];
        
        if (projectIds.length > 0) {
          ({ data, error } = await query.in('id', projectIds));
        } else {
          data = [];
        }
      }

      if (error) throw error;
      setProjects(data || []);
      
      // Fetch stats for each project
      if (data) {
        data.forEach(project => fetchProjectStats(project.id));
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Error loading projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectStats = async (projectId: string) => {
    try {
      // Fetch tasks count
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, status')
        .eq('project_id', projectId);

      if (tasksError) throw tasksError;

      // Fetch images count
      const { data: images, error: imagesError } = await supabase
        .from('images')
        .select('id')
        .eq('project_id', projectId);

      if (imagesError) throw imagesError;

      const totalTasks = tasks?.length || 0;
      const completedTasks = tasks?.filter(t => t.status === 'completed').length || 0;
      const totalImages = images?.length || 0;

      setProjectStats(prev => ({
        ...prev,
        [projectId]: {
          totalTasks,
          completedTasks,
          totalImages
        }
      }));

      // Auto-update project status
      const project = projects.find(p => p.id === projectId);
      await updateProjectStatus(projectId, project?.status || '', {
        totalTasks,
        completedTasks,
        totalImages
      });
    } catch (error) {
      console.error('Error fetching project stats:', error);
    }
  };

  const updateProjectStatus = async (projectId: string, currentStatus: string, stats: ProjectStats) => {
    try {
      // Don't change if already completed
      if (currentStatus === 'completed') return;
      
      // Auto-complete if all tasks are done
      if (stats.totalTasks > 0 && stats.completedTasks === stats.totalTasks) {
        await supabase
          .from('projects')
          .update({ status: 'completed' })
          .eq('id', projectId);
        
        // Refresh projects to show updated status
        fetchProjects();
        return;
      }
      
      // Auto-set to in_progress if has tasks and not already in progress
      if (stats.totalTasks > 0 && currentStatus !== 'in_progress') {
        await supabase
          .from('projects')
          .update({ status: 'in_progress' })
          .eq('id', projectId);
        
        // Refresh projects to show updated status
        fetchProjects();
      }
    } catch (error) {
      console.error('Error updating project status:', error);
    }
  };

  const getDaysRemaining = (estimatedDate?: string) => {
    if (!estimatedDate) return null;
    
    const today = new Date();
    const estimated = new Date(estimatedDate);
    const diffTime = estimated.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.clients?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Projects</h2>
          <p className="text-muted-foreground mt-1">
            Manage and track all your architectural projects
          </p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-xl bg-background border-border text-white placeholder:text-muted-foreground"
            />
          </div>
        </div>
        {userRole === 'chief_architect' && (
          <Button variant="success" size="lg" onClick={onCreateProject}>
            <Plus className="h-4 w-4 mr-2" />
            Create Project
          </Button>
        )}
      </div>

      {/* Empty State */}
      {filteredProjects.length === 0 && !searchTerm && (
        <Card className="border-dashed border-2 rounded-xl">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-primary/10 p-6 mb-4">
              <Folder className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {userRole === 'chief_architect' ? 'No Projects Yet' : 'No Assigned Projects'}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              {userRole === 'chief_architect' 
                ? 'Get started by creating your first project to organize tasks, track progress, and manage your team effectively.'
                : 'You haven\'t been assigned to any projects yet. Ask your supervisor to assign you tasks on existing projects.'}
            </p>
            {userRole === 'chief_architect' && (
              <Button variant="success" size="lg" onClick={onCreateProject}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Project
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* No search results */}
      {filteredProjects.length === 0 && searchTerm && (
        <Card className="rounded-xl">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No projects found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search terms
            </p>
          </CardContent>
        </Card>
      )}

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => {
          const stats = projectStats[project.id] || {
            totalTasks: 0,
            completedTasks: 0,
            totalImages: 0
          };
          const daysRemaining = getDaysRemaining(project.estimated_completion_date);

          return (
            <Card 
              key={project.id} 
              className="hover:shadow-lg transition-all duration-200 hover:scale-[1.02] rounded-xl border-2"
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="truncate text-lg">{project.name}</CardTitle>
                    {project.clients?.name && (
                      <CardDescription className="truncate mt-1">
                        {project.clients.name}
                      </CardDescription>
                    )}
                  </div>
                  {userRole === 'chief_architect' && (
                    <div className="flex space-x-1 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEditProject(project)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDeleteProject(project.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Description */}
                {project.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {project.description}
                  </p>
                )}

                {/* Status and Phase */}
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline">
                    {project.status.replace('_', ' ')}
                  </Badge>
                  {project.phase && (
                    <Badge variant="outline">{project.phase}</Badge>
                  )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 pt-2 border-t">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="text-lg font-bold">{stats.completedTasks}/{stats.totalTasks}</div>
                    <div className="text-xs text-muted-foreground">Tasks</div>
                  </div>
                  
                  <div className="text-center border-x">
                    <div className="flex items-center justify-center mb-1">
                      <ImageIcon className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="text-lg font-bold">{stats.totalImages}</div>
                    <div className="text-xs text-muted-foreground">Images</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <Calendar className="h-4 w-4 text-orange-500" />
                    </div>
                    <div className="text-lg font-bold">
                      {daysRemaining !== null ? daysRemaining : '--'}
                    </div>
                    <div className="text-xs text-muted-foreground">Days</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
