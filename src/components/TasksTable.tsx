import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit2, Trash2, Search, Filter, Calendar, User } from 'lucide-react';

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

interface TasksTableProps {
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateStatus: (taskId: string, status: Task['status']) => void;
}

export default function TasksTable({ tasks, onEditTask, onDeleteTask, onUpdateStatus }: TasksTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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

  const filteredAndSortedTasks = tasks
    .filter((task) => {
      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          task.profiles?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          task.projects?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
      
      return matchesSearch && matchesStatus && matchesPriority;
    })
    .sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (sortField) {
        case 'title':
          aValue = a.title;
          bValue = b.title;
          break;
        case 'assignee':
          aValue = a.profiles?.full_name || '';
          bValue = b.profiles?.full_name || '';
          break;
        case 'project':
          aValue = a.projects?.name || '';
          bValue = b.projects?.name || '';
          break;
        case 'due_date':
          aValue = new Date(a.due_date || '9999-12-31');
          bValue = new Date(b.due_date || '9999-12-31');
          break;
        case 'priority':
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          aValue = priorityOrder[a.priority as keyof typeof priorityOrder];
          bValue = priorityOrder[b.priority as keyof typeof priorityOrder];
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          All Tasks Overview
        </CardTitle>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="text-sm text-muted-foreground">
            {filteredAndSortedTasks.length} of {tasks.length} tasks
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('title')}
                >
                  Task {sortField === 'title' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('assignee')}
                >
                  Assignee {sortField === 'assignee' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('project')}
                >
                  Project {sortField === 'project' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('status')}
                >
                  Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('priority')}
                >
                  Priority {sortField === 'priority' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('due_date')}
                >
                  Due Date {sortField === 'due_date' && (sortDirection === 'asc' ? '↑' : '↓')}
                </TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedTasks.map((task) => (
                <TableRow key={task.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">
                    <div>
                      <div className="font-semibold">{task.title}</div>
                      {task.description && (
                        <div className="text-sm text-muted-foreground line-clamp-2">
                          {task.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{task.profiles?.full_name || 'Unassigned'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {task.projects?.name || 'No Project'}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${getStatusColor(task.status)} text-white`}>
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${getPriorityColor(task.priority)} text-white`}>
                      {task.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {task.due_date ? (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className={
                          new Date(task.due_date) < new Date() && task.status !== 'completed'
                            ? 'text-red-600 font-semibold'
                            : ''
                        }>
                          {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No due date</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Select 
                        value={task.status} 
                        onValueChange={(value) => onUpdateStatus(task.id, value as Task['status'])}
                      >
                        <SelectTrigger className="w-28 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEditTask(task)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDeleteTask(task.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredAndSortedTasks.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {tasks.length === 0 ? 'No tasks found' : 'No tasks match your filters'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}