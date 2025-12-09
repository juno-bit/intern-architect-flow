import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  RupeeSign, 
  FileText, 
  Calendar, 
  User, 
  TrendingUp, 
  TrendingDown, 
  Clock,
  Plus,
  Edit,
  Trash2,
  Search,
  Download
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  client_name: string;
}

interface Invoice {
  id: string;
  project_id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  due_date: string;
  issue_date: string;
  paid_date: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  projects?: { name: string; client_name: string };
  profiles?: { full_name: string };
}

interface FinancialsTabProps {
  userId: string;
  userRole: string;
}

const FinancialsTab = ({ userId, userRole }: FinancialsTabProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [form, setForm] = useState({
    project_id: '',
    invoice_number: '',
    amount: '',
    currency: 'INR',  // ✅ Default to INR (Rupees)
    status: 'draft' as Invoice['status'],
    due_date: '',
    issue_date: '',
    paid_date: '',
    description: ''
  });

  // ✅ JR. ARCHITECTS + CHIEF ARCHITECT can modify financials
  const canManageFinancials = () => 
    userRole === 'chief_architect' || userRole === 'jr_architect';

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch projects
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name, client_name')
        .order('name');

      // Fetch invoices with project and profile joins
      const { data: invoicesData, error } = await supabase
        .from('invoices')
        .select(`
          *,
          projects (name, client_name),
          profiles:created_by (full_name)
        `)
        .order('issue_date', { ascending: false });

      if (error) throw error;

      setProjects(projectsData || []);
      setInvoices(invoicesData || []);
    } catch (error) {
      console.error('Error fetching financial data:', error);
      toast.error('Error loading financial data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: Invoice['status']) => {
    const config = {
      draft: { variant: 'secondary' as const, color: 'bg-gray-500' },
      sent: { variant: 'default' as const, color: 'bg-blue-500' },
      paid: { variant: 'success' as const, color: 'bg-green-500' },
      overdue: { variant: 'destructive' as const, color: 'bg-red-500' }
    };
    const badgeConfig = config[status];
    
    return (
      <Badge className={`${badgeConfig.color} text-white border-none`}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0  // ✅ Indian Rupee formatting (no decimals)
    }).format(amount);
  };

  const calculateProjectTotals = (projectId: string) => {
    const projectInvoices = invoices.filter(inv => inv.project_id === projectId);
    const totalBilled = projectInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const totalPaid = projectInvoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.amount, 0);
    const outstanding = totalBilled - totalPaid;
    
    return { totalBilled, totalPaid, outstanding };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.project_id || !form.amount || !form.issue_date) {
      toast.error('Please fill required fields');
      return;
    }

    try {
      const invoiceData = {
        project_id: form.project_id,
        invoice_number: form.invoice_number || `INV-${Date.now()}`,
        amount: parseFloat(form.amount),
        currency: form.currency,
        status: form.status as Invoice['status'],
        due_date: form.due_date || null,
        issue_date: form.issue_date,
        paid_date: form.status === 'paid' ? form.paid_date || new Date().toISOString() : null,
        description: form.description || null,
        created_by: userId
      };

      if (editingInvoice) {
        // Update existing invoice
        const { error } = await supabase
          .from('invoices')
          .update(invoiceData)
          .eq('id', editingInvoice.id);
        
        if (error) throw error;
        toast.success('Invoice updated successfully');
      } else {
        // Create new invoice
        const { error } = await supabase
          .from('invoices')
          .insert(invoiceData);
        
        if (error) throw error;
        toast.success('Invoice created successfully');
      }

      resetForm();
      fetchData();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error('Failed to save invoice');
    }
  };

  const handleDelete = async (invoice: Invoice) => {
    if (!confirm('Delete this invoice? This cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id);
      
      if (error) throw error;
      toast.success('Invoice deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete invoice');
    }
  };

  const resetForm = () => {
    setForm({
      project_id: '',
      invoice_number: '',
      amount: '',
      currency: 'INR',  // ✅ Default INR
      status: 'draft',
      due_date: '',
      issue_date: '',
      paid_date: '',
      description: ''
    });
    setEditingInvoice(null);
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = !searchQuery || 
      invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.projects?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesProject = !projectFilter || invoice.project_id === projectFilter;
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    
    return matchesSearch && matchesProject && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          Financial Management <RupeeSign className="h-6 w-6 text-green-600" />
        </h2>
        {canManageFinancials() && (
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices, projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Projects</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards - INR Formatting */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-xl">
                <RupeeSign className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(invoices.reduce((sum, inv) => sum + inv.amount, 0), 'INR')}
                </div>
                <div className="text-sm text-muted-foreground">Total Billed</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-xl">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(
                    invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0), 
                    'INR'
                  )}
                </div>
                <div className="text-sm text-muted-foreground">Total Paid</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-xl">
                <RupeeSign className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(
                    invoices.reduce((sum, inv) => {
                      if (inv.status !== 'paid') return sum + inv.amount;
                      return sum;
                    }, 0), 
                    'INR'
                  )}
                </div>
                <div className="text-sm text-muted-foreground">Outstanding</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-xl">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">{invoices.length}</div>
                <div className="text-sm text-muted-foreground">Total Invoices</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rest of the component remains same - Invoices List, Form Dialog */}
      {/* [Previous invoices list and form code - unchanged] */}
      
      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No invoices match your filters
              {canManageFinancials() && (
                <>
                  <div className="mt-4">
                    <Button onClick={() => setIsDialogOpen(true)} className="mt-2">
                      Create your first invoice
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="flex gap-4 p-4 border rounded-lg hover:bg-muted/50">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="font-semibold text-lg">{invoice.invoice_number}</div>
                      {getStatusBadge(invoice.status)}
                    </div>
                    <div className="text-2xl font-bold">
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span>Project: {invoice.projects?.name}</span>
                      <span>Client: {invoice.projects?.client_name}</span>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>Due: {format(new Date(invoice.due_date), 'MMM dd, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{format(new Date(invoice.updated_at), 'MMM dd, yyyy HH:mm')}</span>
                      </div>
                    </div>
                    {invoice.description && (
                      <p className="mt-2 text-sm text-muted-foreground italic">
                        "{invoice.description}"
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {canManageFinancials() && (
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setEditingInvoice(invoice);
                            setForm({
                              project_id: invoice.project_id,
                              invoice_number: invoice.invoice_number,
                              amount: invoice.amount.toString(),
                              currency: invoice.currency,
                              status: invoice.status,
                              due_date: invoice.due_date,
                              issue_date: invoice.issue_date,
                              paid_date: invoice.paid_date || '',
                              description: invoice.description || ''
                            });
                            setIsDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => handleDelete(invoice)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button variant="outline" size="icon">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Form Dialog - JR ARCHITECTS + CHIEF ARCHITECTS */}
      {canManageFinancials() && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingInvoice ? 'Edit Invoice' : 'New Invoice'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Select
                value={form.project_id}
                onValueChange={(value) => setForm({ ...form, project_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project *" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name} - {project.client_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Invoice Number (auto-generated if blank)"
                value={form.invoice_number}
                onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  placeholder="Amount (₹)"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
                <Select
                  value={form.currency}
                  onValueChange={(value) => setForm({ ...form, currency: value })}
                >
                  <SelectTrigger>
                    <SelectValue>₹ INR</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">₹ INR</SelectItem>
                    <SelectItem value="USD">$ USD</SelectItem>
                    <SelectItem value="EUR">€ EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Rest of form fields remain same */}
              <Select
                value={form.status}
                onValueChange={(value) => setForm({ ...form, status: value as Invoice['status'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="date"
                  placeholder="Issue Date"
                  value={form.issue_date}
                  onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
                  required
                />
                <Input
                  type="date"
                  placeholder="Due Date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </div>

              {form.status === 'paid' && (
                <Input
                  type="date"
                  placeholder="Paid Date"
                  value={form.paid_date}
                  onChange={(e) => setForm({ ...form, paid_date: e.target.value })}
                />
              )}

              <Textarea
                placeholder="Invoice description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingInvoice ? 'Update Invoice' : 'Create Invoice'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default FinancialsTab;
