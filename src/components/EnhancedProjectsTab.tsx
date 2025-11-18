import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Calendar, 
  Users, 
  CheckCircle2, 
  Clock,
  Image as ImageIcon,
  Search,
  BarChart3,
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
  completionPercentage: number;
  timeBasedPercentage?: number;
  taskCompletionPercentage?: number;
  daysElapsed?: number;
  daysRemaining?: number;
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
      
      // Task-based completion
      const taskCompletionPercentage = totalTasks > 0 
        ? (completedTasks / totalTasks) * 100 
        : 0;
      
      // Time-based progress calculation
      const project = projects.find(p => p.id === projectId);
      let timeBasedPercentage = 0;
      let daysElapsed = 0;
      let daysRemaining = 0;
      
      if (project?.start_date) {
        const startDate = new Date(project.start_date);
        const today = new Date();
        const maxDuration = 3.5 * 365; // 3.5 years in days (1277.5 days)
        
        // Calculate days elapsed since start
        daysElapsed = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Calculate time-based percentage
        timeBasedPercentage = Math.min((daysElapsed / maxDuration) * 100, 100);
        
        // Calculate days remaining (based on 3.5 year timeline)
        daysRemaining = Math.max(maxDuration - daysElapsed, 0);
        
        // If there's an estimated completion date, use it instead
        if (project.estimated_completion_date) {
          const estimatedEnd = new Date(project.estimated_completion_date);
          daysRemaining = Math.floor((estimatedEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }
      }
      
      // Use whichever is greater to show actual progress
      const completionPercentage = Math.max(
        timeBasedPercentage,
        taskCompletionPercentage
      );

      setProjectStats(prev => ({
        ...prev,
        [projectId]: {
          totalTasks,
          completedTasks,
          totalImages: images?.length || 0,
          completionPercentage: Math.round(completionPercentage),
          timeBasedPercentage: Math.round(timeBasedPercentage),
          taskCompletionPercentage: Math.round(taskCompletionPercentage),
          daysElapsed,
          daysRemaining
        }
      }));

      // Auto-update project status
      await updateProjectStatus(projectId, project?.status || '', {
        totalTasks,
        completedTasks,
        totalImages: images?.length || 0,
        completionPercentage: Math.round(completionPercentage)
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

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500 text-white';
      case 'in_progress': return 'bg-blue-500 text-white';
      case 'on_hold': return 'bg-orange-500 text-white';
      case 'planning': return 'bg-purple-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getDaysRemaining = (endDate?: string) => {
    if (!endDate) return null;
    const today = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with search and create button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-1 w-full sm:w-auto">
          <div className="relative">
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
            totalImages: 0,
            completionPercentage: 0
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
                        className="h-8 w-8 p-0"
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
                  <Badge className={getStatusBadgeColor(project.status)}>
                    {project.status.replace('_', ' ')}
                  </Badge>
                  {project.phase && (
                    <Badge variant="outline">{project.phase}</Badge>
                  )}
                </div>

                {/* Progress */}
                {stats.totalTasks > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Overall Progress</span>
                      <span className="font-semibold">
                        {Math.round(stats.completionPercentage)}%
                      </span>
                    </div>
                    <Progress value={stats.completionPercentage} className="h-2" />
                    
                    {/* Show breakdown */}
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Tasks: {stats.taskCompletionPercentage || 0}%</span>
                      <span>Time: {stats.timeBasedPercentage || 0}%</span>
                    </div>
                    
                    {stats.daysRemaining !== undefined && (
                      <div className="text-xs text-muted-foreground">
                        {stats.daysRemaining > 0 
                          ? `${stats.daysRemaining} days remaining`
                          : `${Math.abs(stats.daysRemaining)} days overdue`
                        }
                      </div>
                    )}
                  </div>
                )}

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
                      {daysRemaining !== null ? (
                        daysRemaining > 0 ? daysRemaining : '0'
                      ) : '-'}
                    </div>
                    <div className="text-xs text-muted-foreground">Days</div>
                  </div>
                </div>

                {/* Dates */}
                {(project.start_date || project.estimated_completion_date) && (
                  <div className="space-y-1 text-xs text-muted-foreground pt-2 border-t">
                    {project.start_date && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        <span>Started: {new Date(project.start_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    {project.estimated_completion_date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>Due: {new Date(project.estimated_completion_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary Stats */}
      {filteredProjects.length > 0 && (
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-2 rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Portfolio Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">
                  {filteredProjects.length}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Total Projects</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-500">
                  {filteredProjects.filter(p => p.status === 'completed').length}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Completed</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-500">
                  {filteredProjects.filter(p => p.status === 'in_progress').length}
                </div>
                <p className="text-sm text-muted-foreground mt-1">In Progress</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-500">
                  {filteredProjects.filter(p => p.status === 'planning').length}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Planning</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
