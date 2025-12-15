import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, CheckCircle, Clock, AlertTriangle, User, FolderOpen, MessageSquare } from "lucide-react";
import { ClearanceRequestForm } from "./ClearanceRequestForm";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  due_date?: string;
  assigned_to?: string;
  created_by: string;
  project_id?: string;
  clearance_status?: string;
  cleared_by?: string;
  cleared_at?: string;
  self_assigned?: boolean;
  estimated_hours?: number;
  actual_hours?: number;
  task_phase?: string;
  completed_at?: string;
  created_at: string;
  profiles?: { full_name: string; email: string };
  projects?: { name: string };
}

interface TaskClearance {
  id: string;
  task_id: string;
  requested_by: string;
  cleared_by?: string;
  status: string;
  notes?: string;
  requested_at: string;
  cleared_at?: string;
  tasks?: { title: string };
  requester?: { full_name: string };
}

interface Project {
  id: string;
  name: string;
}

interface User {
  user_id: string;
  full_name: string;
  role: string;
}

interface EnhancedTaskAssignmentProps {
  userId: string;
  userRole: string;
}

export const EnhancedTaskAssignment = ({ userId, userRole }: EnhancedTaskAssignmentProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clearances, setClearances] = useState<TaskClearance[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    due_date: "",
    project_id: "",
    assigned_to: "",
    estimated_hours: "",
    task_phase: "",
  });

  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [createdTasks, setCreatedTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (!userId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchMyTasks(),
          fetchCreatedTasks(),
          fetchCompletedTasks(),
          fetchAllTasks(),
          fetchClearances(),
          fetchProjects(),
          fetchAssignableUsers()
        ]);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  const fetchMyTasks = async () => {
    try {
      let query = supabase
        .from("tasks")
        .select(`
          *,
          profiles:assigned_to(full_name, email),
          projects:project_id(name)
        `)
        .eq("assigned_to", userId)
        .neq("status", "completed")
        .order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setMyTasks((data || []) as unknown as Task[]);
    } catch (error) {
      console.error("Error fetching my tasks:", error);
    }
  };

  const fetchCreatedTasks = async () => {
    try {
      let query = supabase
        .from("tasks")
        .select(`
          *,
          profiles:assigned_to(full_name, email),
          projects:project_id(name)
        `)
        .eq("created_by", userId)
        .neq("status", "completed")
        .order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setCreatedTasks((data || []) as unknown as Task[]);
    } catch (error) {
      console.error("Error fetching created tasks:", error);
    }
  };

  const fetchCompletedTasks = async () => {
    try {
      let query = supabase
        .from("tasks")
        .select(`
          *,
          profiles:assigned_to(full_name, email),
          projects:project_id(name)
        `)
        .eq("status", "completed")
        .order("completed_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setCompletedTasks((data || []) as unknown as Task[]);
    } catch (error) {
      console.error("Error fetching completed tasks:", error);
    }
  };

  const fetchAllTasks = async () => {
    try {
      let query = supabase
        .from("tasks")
        .select(`
          *,
          profiles:assigned_to(full_name, email),
          projects:project_id(name)
        `)
        .neq("status", "completed")
        .order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setAllTasks((data || []) as unknown as Task[]);
    } catch (error) {
      console.error("Error fetching all tasks:", error);
    }
  };

  const fetchClearances = async () => {
    try {
      const { data, error } = await supabase
        .from("task_clearances")
        .select(`
          *,
          tasks:task_id(title),
          requester:requested_by(full_name)
        `)
        .order("requested_at", { ascending: false });

      if (error) throw error;
      setClearances((data || []) as unknown as TaskClearance[]);
    } catch (error) {
      console.error("Error fetching clearances:", error);
    }
  };

  const fetchProjects = async () => {
    try {
      // Fetch ALL projects - no restrictions for self-assignment
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  };

  const fetchAssignableUsers = async () => {
    try {
      const { data, error } = await supabase.rpc("get_assignable_users", {
        requester_uuid: userId
      });

      if (error) throw error;
      setAssignableUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleCreateTask = async () => {
    try {
      // Clean self-assignment logic - assign directly to userId when "self" selected
      const assignedToUserId = newTask.assigned_to === "self" ? userId : newTask.assigned_to || null;
      
      const taskData = {
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority as "low" | "medium" | "high" | "urgent",
        due_date: newTask.due_date || null,
        project_id: newTask.project_id || null,
        assigned_to: assignedToUserId,
        created_by: userId,
        estimated_hours: newTask.estimated_hours ? parseFloat(newTask.estimated_hours) : null,
        task_phase: newTask.task_phase || null,
        self_assigned: newTask.assigned_to === "self"
      };

      const { error } = await supabase.from("tasks").insert(taskData);
      if (error) throw error;

      toast.success("Task created successfully!");
      setShowCreateDialog(false);
      setNewTask({
        title: "",
        description: "",
        priority: "medium",
        due_date: "",
        project_id: "",
        assigned_to: "",
        estimated_hours: "",
        task_phase: "",
      });
      fetchMyTasks();
      fetchCreatedTasks();
      fetchAllTasks();
    } catch (error: any) {
      console.error("Error creating task:", error);
      toast.error("Failed to create task: " + error.message);
    }
  };

  const handleRequestClearance = async (taskId: string) => {
    try {
      const { error } = await supabase.from("task_clearances").insert({
        task_id: taskId,
        requested_by: userId,
        status: "pending"
      });

      if (error) throw error;
      toast.success("Clearance requested successfully!");
      fetchClearances();
      fetchMyTasks();
      fetchCreatedTasks();
    } catch (error: any) {
      console.error("Error requesting clearance:", error);
      toast.error("Failed to request clearance: " + error.message);
    }
  };

  const handleClearanceAction = async (clearanceId: string, action: "approve" | "reject", notes?: string) => {
    try {
      const { error } = await supabase
        .from("task_clearances")
        .update({
          status: action === "approve" ? "approved" : "rejected",
          cleared_by: userId,
          cleared_at: new Date().toISOString(),
          notes: notes
        })
        .eq("id", clearanceId);

      if (error) throw error;
      toast.success(`Clearance ${action}d successfully!`);
      fetchClearances();
      fetchMyTasks();
      fetchCreatedTasks();
      fetchCompletedTasks();
    } catch (error: any) {
      console.error("Error updating clearance:", error);
      toast.error("Failed to update clearance: " + error.message);
    }
  };

  const handleMarkComplete = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString()
        })
        .eq("id", taskId);

      if (error) throw error;
      toast.success("Task marked as complete!");
      fetchMyTasks();
      fetchCompletedTasks();
      fetchAllTasks();
    } catch (error: any) {
      console.error("Error completing task:", error);
      toast.error("Failed to mark task as complete: " + error.message);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: "bg-yellow-500",
      in_progress: "bg-blue-500",
      completed: "bg-green-500",
      overdue: "bg-red-500"
    };
    return colors[status as keyof typeof colors] || "bg-gray-500";
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: "bg-green-500",
      medium: "bg-yellow-500",
      high: "bg-orange-500",
      urgent: "bg-red-500"
    };
    return colors[priority as keyof typeof colors] || "bg-gray-500";
  };

  const canCreateTasks = userRole === "chief_architect" || userRole === "junior_architect";
  const canManageClearances = userRole === "chief_architect";
  const pendingClearances = clearances.filter(clearance => clearance.status === "pending");

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Enhanced Task Management</h2>
        {canCreateTasks && (
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button variant="success" size="lg">
                <Plus className="h-4 w-4 mr-2" />
                Create Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Task title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                />
                <Textarea
                  placeholder="Task description"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Select value={newTask.priority} onValueChange={(value) => setNewTask({ ...newTask, priority: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border border-border z-50">
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Select value={newTask.project_id} onValueChange={(value) => setNewTask({ ...newTask, project_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select project (any allowed)" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border border-border z-50">
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={newTask.assigned_to} onValueChange={(value) => setNewTask({ ...newTask, assigned_to: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Assign to" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border border-border z-50">
                      {(userRole === "junior_architect" || userRole === "intern") && <SelectItem value="self">Self</SelectItem>}
                      {assignableUsers.map((user) => (
                        <SelectItem key={user.user_id} value={user.user_id}>
                          {user.full_name} ({user.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    placeholder="Estimated hours"
                    type="number"
                    min="0"
                    step="0.5"
                    value={newTask.estimated_hours}
                    onChange={(e) => setNewTask({ ...newTask, estimated_hours: e.target.value })}
                  />
                  <Input
                    placeholder="Task phase"
                    value={newTask.task_phase}
                    onChange={(e) => setNewTask({ ...newTask, task_phase: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateTask} variant="success" size="lg">Create Task</Button>
                  <Button variant="outline" size="lg" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="my-tasks" className="w-full">
        <TabsList className={`grid w-full ${userRole === "intern" ? "grid-cols-4" : "grid-cols-5"}`}>
          <TabsTrigger value="my-tasks">My Tasks</TabsTrigger>
          {userRole !== "intern" && <TabsTrigger value="created-tasks">Created Tasks</TabsTrigger>}
          <TabsTrigger value="clearances">Clearances</TabsTrigger>
          <TabsTrigger value="all-tasks">All Tasks</TabsTrigger>
          <TabsTrigger value="completed-tasks">Completed Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="my-tasks" className="space-y-4">
          <h3 className="text-lg font-semibold">My Assigned Tasks</h3>
          {myTasks.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No tasks assigned to you yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {myTasks.map((task) => (
                <Card key={task.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold">{task.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Badge className={`${getStatusColor(task.status)} text-white border-0`}>{task.status}</Badge>
                          <Badge className={`${getPriorityColor(task.priority)} text-white border-0`}>{task.priority}</Badge>
                          {task.projects?.name && (
                            <Badge className="bg-blue-500 text-white border-0">{task.projects.name}</Badge>
                          )}
                          {task.self_assigned && (
                            <Badge variant="secondary">Self-assigned</Badge>
                          )}
                        </div>
                        {task.due_date && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Due: {new Date(task.due_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {userRole !== 'chief_architect' && (
                        <div className="flex gap-2">
                          {task.status !== 'completed' && (
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => handleMarkComplete(task.id)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Mark Complete
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRequestClearance(task.id)}
                          >
                            Request Clearance
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {userRole !== "intern" && (
          <TabsContent value="created-tasks" className="space-y-4">
            <h3 className="text-lg font-semibold">Tasks I Created</h3>
            {createdTasks.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">You haven't created any tasks yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {createdTasks.map((task) => (
                  <Card key={task.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-semibold">{task.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                          <div className="flex flex-wrap gap-2 mt-3">
                            <Badge className={`${getStatusColor(task.status)} text-white border-0`}>{task.status}</Badge>
                            <Badge className={`${getPriorityColor(task.priority)} text-white border-0`}>{task.priority}</Badge>
                            {task.projects?.name && (
                              <Badge className="bg-blue-500 text-white border-0">{task.projects.name}</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Assigned to: {task.profiles?.full_name || "Unassigned"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="clearances" className="space-y-4">
          {userRole === 'chief_architect' ? (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Pending Clearances to Review</h3>
              {pendingClearances.length === 0 ? (
                <Card className="rounded-xl">
                  <CardContent className="py-8 text-center">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No pending clearances to review</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {pendingClearances.map((clearance) => (
                    <Card key={clearance.id} className="hover:shadow-lg transition-all rounded-xl">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h4 className="font-semibold text-lg">{clearance.tasks?.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Requested by: {clearance.requester?.full_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(clearance.requested_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge className="bg-yellow-500 text-white rounded-lg px-3 py-1">
                            {clearance.status}
                          </Badge>
                        </div>
                        {clearance.notes && (
                          <div className="mb-4 p-3 bg-muted rounded-lg">
                            <p className="text-sm font-medium">Notes:</p>
                            <p className="text-sm text-muted-foreground">{clearance.notes}</p>
                          </div>
                        )}
                        <div className="flex gap-3">
                          <Button
                            variant="success"
                            size="lg"
                            className="flex-1"
                            onClick={() => handleClearanceAction(clearance.id, "approve")}
                          >
                            Approve
                          </Button>
                          <Button
                            size="lg"
                            variant="destructive"
                            className="flex-1"
                            onClick={() => handleClearanceAction(clearance.id, "reject")}
                          >
                            Reject
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ClearanceRequestForm userId={userId} userRole={userRole} />
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">My Pending Clearances</h3>
                {clearances.filter(c => c.status === 'pending' && c.requested_by === userId).length === 0 ? (
                  <Card className="rounded-xl">
                    <CardContent className="py-8 text-center">
                      <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No pending clearances</p>
                    </CardContent>
                  </Card>
                ) : (
                  clearances.filter(c => c.status === 'pending' && c.requested_by === userId).map(clearance => (
                    <Card key={clearance.id} className="hover:shadow-md transition-shadow rounded-xl">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h4 className="font-semibold">{clearance.tasks?.title}</h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(clearance.requested_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge className="bg-yellow-500 text-white rounded-lg">
                            {clearance.status}
                          </Badge>
                        </div>
                        {clearance.notes && (
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-sm font-medium">Notes:</p>
                            <p className="text-sm text-muted-foreground">{clearance.notes}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="all-tasks" className="space-y-4">
          <h3 className="text-lg font-semibold">All Active Tasks (Everyone's Tasks)</h3>
          {allTasks.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No active tasks.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {allTasks.slice(0, 15).map((task) => (
                <Card key={task.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold">{task.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Badge className={`${getStatusColor(task.status)} text-white border-0`}>{task.status}</Badge>
                          <Badge className={`${getPriorityColor(task.priority)} text-white border-0`}>{task.priority}</Badge>
                          {task.projects?.name && (
                            <Badge className="bg-blue-500 text-white border-0">{task.projects.name}</Badge>
                          )}
                          {task.self_assigned && (
                            <Badge variant="secondary">Self-assigned</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Assigned to: {task.profiles?.full_name || "Unassigned"} | Created by: {task.created_by}
                        </p>
                        {task.due_date && (
                          <p className="text-xs text-muted-foreground">
                            Due: {new Date(task.due_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed-tasks" className="space-y-4">
          <h3 className="text-lg font-semibold">Completed Tasks</h3>
          {completedTasks.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No completed tasks yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {completedTasks.map((task) => (
                <Card key={task.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold">{task.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Badge className="bg-green-500 text-white border-0">completed</Badge>
                          <Badge className={`${getPriorityColor(task.priority)} text-white border-0`}>{task.priority}</Badge>
                          {task.projects?.name && (
                            <Badge className="bg-blue-500 text-white border-0">{task.projects.name}</Badge>
                          )}
                          {task.cleared_at && (
                            <Badge className="bg-green-500 text-white border-0">Cleared</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2 space-y-1">
                          <p>Assigned to: {task.profiles?.full_name || "Unassigned"}</p>
                          {task.completed_at && (
                            <p>Completed: {new Date(task.completed_at).toLocaleDateString()}</p>
                          )}
                          {task.cleared_at && (
                            <p>Cleared: {new Date(task.cleared_at).toLocaleDateString()}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
