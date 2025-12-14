import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
  SelectLabel,
  SelectGroup,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, IndianRupee, FileText, Calendar, CheckCircle, Download, CreditCard, Check, X } from 'lucide-react';
import jsPDF from 'jspdf';

interface Project {
  id: string;
  name: string;
}

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

interface Invoice {
  id: string;
  project_id: string | null;
  invoice_number: string;
  amount: number;
  paid_amount: number;
  currency: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  paid_date: string | null;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  projects?: { name: string } | null;
}

interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  notes: string | null;
  recorded_by: string;
  created_at: string;
}

interface FinancialsTabProps {
  userId: string;
  userRole: string;
}

export function FinancialsTab({ userId, userRole }: FinancialsTabProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [form, setForm] = useState({
    project_id: '',
    invoice_number: '',
    amount: '',
    status: 'draft' as InvoiceStatus,
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
    description: '',
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: '',
    notes: '',
  });
  const [statusAction, setStatusAction] = useState<'settled' | 'cancelled' | null>(null);

  const canManageFinancials = () => {
    return userRole === 'junior_architect' || userRole === 'chief_architect';
  };

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projectsRes, invoicesRes] = await Promise.all([
        supabase.from('projects').select('id, name').order('name'),
        supabase.from('invoices').select('*, projects(name)').order('created_at', { ascending: false }),
      ]);

      if (projectsRes.error) throw projectsRes.error;
      if (invoicesRes.error) throw invoicesRes.error;

      setProjects(projectsRes.data || []);
      setInvoices((invoicesRes.data as Invoice[]) || []);
    } catch (error: any) {
      toast.error(error.message || 'Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    const styles: Record<InvoiceStatus, string> = {
      draft: 'bg-muted text-muted-foreground',
      sent: 'bg-blue-500/20 text-blue-400',
      paid: 'bg-green-500/20 text-green-400',
      overdue: 'bg-red-500/20 text-red-400',
      cancelled: 'bg-gray-500/20 text-gray-400',
    };
    return <Badge className={styles[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  // Format currency in Indian numbering system (lakhs, crores)
  const formatCurrencyIndian = (amount: number): string => {
    const absAmount = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    
    if (absAmount >= 10000000) {
      return `${sign}₹${(absAmount / 10000000).toFixed(2)} Cr`;
    } else if (absAmount >= 100000) {
      return `${sign}₹${(absAmount / 100000).toFixed(2)} L`;
    } else {
      return `${sign}₹${absAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  };

  const formatCurrencyFull = (amount: number): string => {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatCurrency = formatCurrencyFull;

  const parseIndianCurrencyInput = (input: string): number => {
    const cleanInput = input.trim().toLowerCase().replace(/,/g, '');
    
    const croreMatch = cleanInput.match(/^([\d.]+)\s*(crore|cr)s?$/);
    if (croreMatch) return parseFloat(croreMatch[1]) * 10000000;
    
    const lakhMatch = cleanInput.match(/^([\d.]+)\s*(lakh|lac|l)s?$/);
    if (lakhMatch) return parseFloat(lakhMatch[1]) * 100000;
    
    const thousandMatch = cleanInput.match(/^([\d.]+)\s*(thousand|k)s?$/);
    if (thousandMatch) return parseFloat(thousandMatch[1]) * 1000;
    
    const plainNumber = parseFloat(cleanInput);
    return isNaN(plainNumber) ? 0 : plainNumber;
  };

  // ✅ NEW: Direct status update function
  const handleStatusUpdate = async (invoice: Invoice, newStatus: 'paid' | 'cancelled') => {
    try {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'paid') {
        // Mark as fully paid if not already
        if ((invoice.paid_amount || 0) < invoice.amount) {
          updateData.paid_amount = invoice.amount;
          updateData.paid_date = new Date().toISOString().split('T')[0];
        }
      } else if (newStatus === 'cancelled') {
        // Reset paid_amount for cancelled invoices
        updateData.paid_amount = 0;
        updateData.paid_date = null;
      }

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoice.id);

      if (error) throw error;

      toast.success(`Invoice marked as ${newStatus}`);
      setStatusDialogOpen(false);
      setSelectedInvoice(null);
      setStatusAction(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || `Error updating status to ${newStatus}`);
    }
  };

  const exportToPDF = (invoice: Invoice) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', pageWidth / 2, 30, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Invoice #: ${invoice.invoice_number}`, 20, 50);
    doc.text(`Status: ${invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}`, pageWidth - 20, 50, { align: 'right' });
    
    doc.setLineWidth(0.5);
    doc.line(20, 55, pageWidth - 20, 55);
    
    let yPos = 70;
    if (invoice.projects?.name) {
      doc.setFont('helvetica', 'bold');
      doc.text('Project:', 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(invoice.projects.name, 60, yPos);
      yPos += 10;
    }
    
    doc.setFont('helvetica', 'bold');
    doc.text('Issue Date:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(invoice.issue_date).toLocaleDateString('en-IN'), 60, yPos);
    yPos += 10;
    
    if (invoice.due_date) {
      doc.setFont('helvetica', 'bold');
      doc.text('Due Date:', 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date(invoice.due_date).toLocaleDateString('en-IN'), 60, yPos);
      yPos += 10;
    }
    
    if (invoice.paid_date) {
      doc.setFont('helvetica', 'bold');
      doc.text('Paid Date:', 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date(invoice.paid_date).toLocaleDateString('en-IN'), 60, yPos);
      yPos += 10;
    }
    
    if (invoice.description) {
      yPos += 10;
      doc.setFont('helvetica', 'bold');
      doc.text('Description:', 20, yPos);
      yPos += 8;
      doc.setFont('helvetica', 'normal');
      const descLines = doc.splitTextToSize(invoice.description, pageWidth - 40);
      doc.text(descLines, 20, yPos);
      yPos += descLines.length * 7;
    }
    
    yPos += 20;
    doc.setLineWidth(0.3);
    doc.line(20, yPos, pageWidth - 20, yPos);
    yPos += 15;
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Total Amount:', 20, yPos);
    doc.text(formatCurrencyFull(invoice.amount), pageWidth - 20, yPos, { align: 'right' });
    
    yPos += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`(${numberToWordsIndian(invoice.amount)} Only)`, 20, yPos);
    
    doc.setFontSize(8);
    doc.text(`Generated on ${new Date().toLocaleDateString('en-IN')}`, pageWidth / 2, 280, { align: 'center' });
    
    doc.save(`${invoice.invoice_number}.pdf`);
    toast.success('Invoice PDF downloaded');
  };

  const numberToWordsIndian = (num: number): string => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    if (num === 0) return 'Zero Rupees';
    
    const rupees = Math.floor(num);
    const paise = Math.round((num - rupees) * 100);
    
    const convertBelowThousand = (n: number): string => {
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertBelowThousand(n % 100) : '');
    };
    
    let words = '';
    let remaining = rupees;
    
    if (remaining >= 10000000) {
      words += convertBelowThousand(Math.floor(remaining / 10000000)) + ' Crore ';
      remaining = remaining % 10000000;
    }
    if (remaining >= 100000) {
      words += convertBelowThousand(Math.floor(remaining / 100000)) + ' Lakh ';
      remaining = remaining % 100000;
    }
    if (remaining >= 1000) {
      words += convertBelowThousand(Math.floor(remaining / 1000)) + ' Thousand ';
      remaining = remaining % 1000;
    }
    if (remaining > 0) {
      words += convertBelowThousand(remaining);
    }
    
    words = words.trim() + ' Rupees';
    if (paise > 0) {
      words += ' and ' + convertBelowThousand(paise) + ' Paise';
    }
    
    return words;
  };

  const handleSubmit = async () => {
    if (!form.invoice_number || !form.amount) {
      toast.error('Invoice number and amount are required');
      return;
    }

    try {
      const invoiceData = {
        project_id: form.project_id || null,
        invoice_number: form.invoice_number,
        amount: parseIndianCurrencyInput(form.amount),
        status: form.status,
        issue_date: form.issue_date,
        due_date: form.due_date || null,
        description: form.description || null,
        created_by: userId,
      };

      if (editingInvoice) {
        const { error } = await supabase
          .from('invoices')
          .update(invoiceData)
          .eq('id', editingInvoice.id);
        if (error) throw error;
        toast.success('Invoice updated');
      } else {
        const { error } = await supabase.from('invoices').insert(invoiceData);
        if (error) throw error;
        toast.success('Invoice created');
      }

      resetForm();
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Error saving invoice');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    try {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
      toast.success('Invoice deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Error deleting invoice');
    }
  };

  const resetForm = () => {
    setForm({
      project_id: '',
      invoice_number: '',
      amount: '',
      status: 'draft',
      issue_date: new Date().toISOString().split('T')[0],
      due_date: '',
      description: '',
    });
    setEditingInvoice(null);
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      amount: '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: '',
      notes: '',
    });
    setSelectedInvoice(null);
  };

  const openPaymentDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    const remaining = invoice.amount - (invoice.paid_amount || 0);
    setPaymentForm({
      amount: remaining > 0 ? remaining.toString() : '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: '',
      notes: '',
    });
    setPaymentDialogOpen(true);
  };

  // ✅ FIXED: Correctly calculates totalReceived using paid_amount
  const totalBilled = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalReceived = invoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
  // ✅ FIXED: Outstanding now correctly reflects ALL paid_amount changes
  const totalOutstanding = invoices
    .filter((inv) => inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + (inv.amount - (inv.paid_amount || 0)), 0);

  const handleRecordPayment = async () => {
    if (!selectedInvoice || !paymentForm.amount) {
      toast.error('Payment amount is required');
      return;
    }

    const paymentAmount = parseIndianCurrencyInput(paymentForm.amount);
    const remaining = selectedInvoice.amount - (selectedInvoice.paid_amount || 0);
    
    if (paymentAmount > remaining) {
      toast.error(`Payment exceeds remaining balance of ${formatCurrencyFull(remaining)}`);
      return;
    }

    try {
      const { error: paymentError } = await supabase.from('invoice_payments').insert({
        invoice_id: selectedInvoice.id,
        amount: paymentAmount,
        payment_date: paymentForm.payment_date,
        payment_method: paymentForm.payment_method || null,
        notes: paymentForm.notes || null,
        recorded_by: userId,
      });
      if (paymentError) throw paymentError;

      const newPaidAmount = (selectedInvoice.paid_amount || 0) + paymentAmount;
      const newStatus = newPaidAmount >= selectedInvoice.amount ? 'paid' : selectedInvoice.status;
      const paidDate = newPaidAmount >= selectedInvoice.amount ? new Date().toISOString().split('T')[0] : selectedInvoice.paid_date;

      const { error: updateError } = await supabase
        .from('invoices')
        .update({ 
          paid_amount: newPaidAmount,
          status: newStatus,
          paid_date: paidDate
        })
        .eq('id', selectedInvoice.id);
      if (updateError) throw updateError;

      toast.success('Payment recorded');
      resetPaymentForm();
      setPaymentDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Error recording payment');
    }
  };

  const startEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setForm({
      project_id: invoice.project_id || '',
      invoice_number: invoice.invoice_number,
      amount: invoice.amount.toString(),
      status: invoice.status,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date || '',
      description: invoice.description || '',
    });
    setDialogOpen(true);
  };

  // ✅ NEW: Open status confirmation dialog
  const openStatusDialog = (invoice: Invoice, action: 'settled' | 'cancelled') => {
    setSelectedInvoice(invoice);
    setStatusAction(action);
    setStatusDialogOpen(true);
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.projects?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = projectFilter === 'all' || invoice.project_id === projectFilter;
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesProject && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-foreground">Financials</h2>
        {canManageFinancials() && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-card">
              <DialogHeader>
                <DialogTitle className="text-foreground">{editingInvoice ? 'Edit Invoice' : 'Create Invoice'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-foreground">Invoice Number *</Label>
                  <Input
                    value={form.invoice_number}
                    onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                    placeholder="INV-001"
                    className="text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-foreground">Project</Label>
                  <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-foreground">Amount (INR) *</Label>
                  <Input
                    type="text"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="e.g., 5 lakh, 2.5 crore, 50 thousand"
                    className="text-foreground"
                  />
                  {form.amount && (
                    <p className="text-xs text-muted-foreground mt-1">
                      = {formatCurrencyFull(parseIndianCurrencyInput(form.amount))}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-foreground">Issue Date</Label>
                    <Input
                      type="date"
                      value={form.issue_date}
                      onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
                      className="text-foreground"
                    />
                  </div>
                  <div>
                    <Label className="text-foreground">Due Date</Label>
                    <Input
                      type="date"
                      value={form.due_date}
                      onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                      className="text-foreground"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-foreground">Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as InvoiceStatus })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectGroup>
                        <SelectLabel className="text-xs text-muted-foreground">Pending</SelectLabel>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectGroup>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel className="text-xs text-muted-foreground">Settled</SelectLabel>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-foreground">Description</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Invoice details..."
                    className="text-foreground"
                  />
                </div>
                <Button onClick={handleSubmit} className="w-full">
                  {editingInvoice ? 'Update Invoice' : 'Create Invoice'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 text-foreground"
          />
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel className="text-xs text-muted-foreground">Pending</SelectLabel>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel className="text-xs text-muted-foreground">Settled</SelectLabel>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* ✅ NEW: Status Confirmation Dialog */}
      <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Mark {statusAction === 'settled' ? 'as Settled' : 'as Cancelled'}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/80">
              {selectedInvoice && (
                <>
                  Invoice <span className="font-semibold">{selectedInvoice.invoice_number}</span> will be marked as{' '}
                  <span className="font-semibold capitalize">{statusAction}</span>.
                  {statusAction === 'cancelled' && ' Any recorded payments will be reset.'}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => selectedInvoice && statusAction && handleStatusUpdate(selectedInvoice, statusAction === 'settled' ? 'paid' : 'cancelled')}
              className={statusAction === 'settled' ? 'bg-green-600 hover:bg-green-700' : 'bg-destructive hover:bg-destructive/90'}
            >
              {statusAction === 'settled' ? 'Mark Settled' : 'Cancel Invoice'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={(open) => { setPaymentDialogOpen(open); if (!open) resetPaymentForm(); }}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">Record Payment</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Invoice: <span className="font-medium text-foreground">{selectedInvoice.invoice_number}</span></p>
                <p className="text-sm text-muted-foreground">Total: <span className="font-medium text-foreground">{formatCurrencyFull(selectedInvoice.amount)}</span></p>
                <p className="text-sm text-muted-foreground">Paid: <span className="font-medium text-green-500">{formatCurrencyFull(selectedInvoice.paid_amount || 0)}</span></p>
                <p className="text-sm text-muted-foreground">Remaining: <span className="font-medium text-foreground">{formatCurrencyFull(selectedInvoice.amount - (selectedInvoice.paid_amount || 0))}</span></p>
              </div>
              <div>
                <Label className="text-foreground">Payment Amount *</Label>
                <Input
                  type="text"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  placeholder="e.g., 50 thousand, 1 lakh"
                  className="text-foreground"
                />
                {paymentForm.amount && (
                  <p className="text-xs text-muted-foreground mt-1">
                    = {formatCurrencyFull(parseIndianCurrencyInput(paymentForm.amount))}
                  </p>
                )}
              </div>
              <div>
                <Label className="text-foreground">Payment Date</Label>
                <Input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  className="text-foreground"
                />
              </div>
              <div>
                <Label className="text-foreground">Payment Method</Label>
                <Select value={paymentForm.payment_method} onValueChange={(v) => setPaymentForm({ ...paymentForm, payment_method: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-foreground">Notes</Label>
                <Textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  placeholder="Payment notes..."
                  className="text-foreground"
                />
              </div>
              <Button onClick={handleRecordPayment} className="w-full">
                <CreditCard className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Summary Cards - NOW CORRECTLY REFLECTS paid_amount */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Billed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold text-foreground">{formatCurrencyIndian(totalBilled)}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Received</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold text-foreground">{formatCurrencyIndian(totalReceived)}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-yellow-500" />
              <span className="text-2xl font-bold text-foreground">{formatCurrencyIndian(totalOutstanding)}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold text-foreground">{invoices.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices List */}
      <div className="space-y-3">
        {filteredInvoices.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-8 text-center text-muted-foreground">
              No invoices found
            </CardContent>
          </Card>
        ) : (
          filteredInvoices.map((invoice) => {
            const paidAmount = invoice.paid_amount || 0;
            const paymentProgress = invoice.amount > 0 ? (paidAmount / invoice.amount) * 100 : 0;
            const remaining = invoice.amount - paidAmount;
            const isFullyPaid = paidAmount >= invoice.amount;
            
            return (
              <Card key={invoice.id} className="bg-card border-border hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-foreground">{invoice.invoice_number}</span>
                          {getStatusBadge(invoice.status)}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {invoice.projects?.name && <p>Project: {invoice.projects.name}</p>}
                          <p>Issued: {new Date(invoice.issue_date).toLocaleDateString('en-IN')}</p>
                          {invoice.due_date && <p>Due: {new Date(invoice.due_date).toLocaleDateString('en-IN')}</p>}
                          {invoice.description && <p className="line-clamp-1">{invoice.description}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-xl font-bold text-foreground">{formatCurrencyFull(invoice.amount)}</span>
                          {paidAmount > 0 && (
                            <p className={`text-xs ${isFullyPaid ? 'text-green-500' : 'text-green-500'}`}>
                              Paid: {formatCurrencyFull(paidAmount)}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Button variant="ghost" size="icon" onClick={() => exportToPDF(invoice)} title="Download PDF">
                            <Download className="h-4 w-4" />
                          </Button>
                          
                          {/* ✅ NEW: Quick status buttons */}
                          {canManageFinancials() && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => openStatusDialog(invoice, 'settled')}
                                title="Mark as Settled"
                                className="text-green-500 hover:text-green-600 hover:bg-green-500/10"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => openStatusDialog(invoice, 'cancelled')}
                                title="Cancel Invoice"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          
                          {/* Payment button only for partially paid or unpaid */}
                          {canManageFinancials() && !isFullyPaid && invoice.status !== 'cancelled' && (
                            <Button variant="ghost" size="icon" onClick={() => openPaymentDialog(invoice)} title="Record Payment">
                              <CreditCard className="h-4 w-4 text-green-500" />
                            </Button>
                          )}
                          
                          {canManageFinancials() && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => startEdit(invoice)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {userRole === 'chief_architect' && (
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(invoice.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Payment Progress */}
                    {paidAmount > 0 && !isFullyPaid && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Payment Progress</span>
                          <span>{Math.round(paymentProgress)}% ({formatCurrencyIndian(remaining)} remaining)</span>
                        </div>
                        <Progress value={paymentProgress} className="h-2" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

export default FinancialsTab;
