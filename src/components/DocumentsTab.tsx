import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  FileText, 
  FileSpreadsheet, 
  File, 
  FileImage,
  Download,
  Trash2,
  Edit,
  Plus,
  Search,
  Upload,
  Eye
} from 'lucide-react';

interface Document {
  id: string;
  name: string;
  file_path: string;
  url: string;
  file_size: number | null;
  mime_type: string | null;
  file_extension: string | null;
  description: string | null;
  uploaded_by: string;
  project_id: string | null;
  created_at: string;
  projects?: { name: string } | null;
  profiles?: { full_name: string } | null;
}

interface Project {
  id: string;
  name: string;
}

interface DocumentsTabProps {
  userId: string;
  userRole: string;
}

const DocumentsTab = ({ userId, userRole }: DocumentsTabProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    description: '',
    project_id: ''
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    fetchDocuments();
    fetchProjects();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const { data: docsData, error: docsError } = await supabase
        .from('documents')
        .select(`
          *,
          projects (name)
        `)
        .order('created_at', { ascending: false });

      if (docsError) throw docsError;

      // Fetch profiles separately
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p.full_name]) || []);

      const docsWithProfiles = (docsData || []).map(doc => ({
        ...doc,
        profiles: { full_name: profilesMap.get(doc.uploaded_by) || 'Unknown' }
      }));

      setDocuments(docsWithProfiles as Document[]);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Error loading documents');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    const { data } = await supabase.from('projects').select('id, name').order('name');
    setProjects(data || []);
  };

  const getFileIcon = (extension: string | null, mimeType: string | null) => {
    const ext = extension?.toLowerCase();
    const mime = mimeType?.toLowerCase() || '';

    if (ext === 'xlsx' || ext === 'xls' || mime.includes('spreadsheet')) {
      return <FileSpreadsheet className="h-8 w-8 text-green-500" />;
    }
    if (ext === 'docx' || ext === 'doc' || mime.includes('document')) {
      return <FileText className="h-8 w-8 text-blue-500" />;
    }
    if (ext === 'pdf' || mime.includes('pdf')) {
      return <FileText className="h-8 w-8 text-red-500" />;
    }
    if (ext === 'dwg' || ext === 'dxf' || ext === 'cad') {
      return <File className="h-8 w-8 text-orange-500" />;
    }
    if (mime.includes('image')) {
      return <FileImage className="h-8 w-8 text-purple-500" />;
    }
    return <File className="h-8 w-8 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // View document functionality - Available to ALL users
  const viewDocument = (doc: Document) => {
    setPreviewUrl(doc.url);
    setIsPreviewOpen(true);
  };

  // FULL ACCESS FOR EVERYONE
  const canUpload = () => true; // Everyone can upload
  const canManageDocument = () => true; // Everyone can edit/delete ANY document

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile && !editingDocument) {
      toast.error('Please select a file');
      return;
    }

    try {
      setUploading(true);

      if (editingDocument) {
        // Update existing document
        const { error } = await supabase
          .from('documents')
          .update({
            description: form.description || null,
            project_id: form.project_id || null
          })
          .eq('id', editingDocument.id);

        if (error) throw error;
        toast.success('Document updated successfully');
      } else if (selectedFile) {
        // Upload new file
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `documents/${userId}/${Date.now()}_${selectedFile.name}`;

        const { error: uploadError } = await supabase.storage
          .from('WI storage')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('WI storage')
          .getPublicUrl(filePath);

        const { error: insertError } = await supabase
          .from('documents')
          .insert({
            name: selectedFile.name,
            file_path: filePath,
            url: urlData.publicUrl,
            file_size: selectedFile.size,
            mime_type: selectedFile.type,
            file_extension: fileExt,
            description: form.description || null,
            uploaded_by: userId,
            project_id: form.project_id || null
          });

        if (insertError) throw insertError;
        toast.success('Document uploaded successfully');
      }

      resetForm();
      fetchDocuments();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error saving document');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      // Delete from storage
      await supabase.storage.from('WI storage').remove([doc.file_path]);

      // Delete from database
      const { error } = await supabase.from('documents').delete().eq('id', doc.id);
      if (error) throw error;

      toast.success('Document deleted');
      fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Error deleting document');
    }
  };

  const startEdit = (doc: Document) => {
    setEditingDocument(doc);
    setForm({
      description: doc.description || '',
      project_id: doc.project_id || ''
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setForm({ description: '', project_id: '' });
    setSelectedFile(null);
    setEditingDocument(null);
    setIsDialogOpen(false);
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = !searchQuery || 
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = !projectFilter || projectFilter === 'all' || doc.project_id === projectFilter;
    return matchesSearch && matchesProject;
  });

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-foreground">Document Repository</CardTitle>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background text-foreground"
            />
          </div>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by project" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Documents List */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading documents...</div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No documents found. Upload your first document!
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDocuments.map(doc => (
              <div
                key={doc.id}
                className="flex items-center gap-4 p-4 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors"
              >
                {getFileIcon(doc.file_extension, doc.mime_type)}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">{doc.name}</div>
                  {doc.description && (
                    <div className="text-sm text-muted-foreground truncate">{doc.description}</div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span>•</span>
                    <span>{format(new Date(doc.created_at), 'MMM d, yyyy h:mm a')}</span>
                    <span>•</span>
                    <span>by {doc.profiles?.full_name}</span>
                    {doc.projects?.name && (
                      <>
                        <span>•</span>
                        <span className="text-primary">Project: {doc.projects.name}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {/* View - Available to EVERYONE */}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => viewDocument(doc)}
                    title="View Document"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  
                  {/* Download - Available to EVERYONE */}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(doc.url, '_blank')}
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  
                  {/* Edit - Available to EVERYONE (ANY document) */}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => startEdit(doc)}
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  
                  {/* Delete - Available to EVERYONE (ANY document) */}
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDelete(doc)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  
                  {/* Upload - Available to EVERYONE */}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsDialogOpen(true)}
                    title="Upload New"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Document Preview Dialog - Available to EVERYONE */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0 bg-card border-border">
            <DialogHeader className="p-6 border-b border-border">
              <DialogTitle className="text-foreground flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Document Preview
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(previewUrl || '', '_blank')}
                className="mt-2"
              >
                <Download className="h-4 w-4 mr-2" />
                Open in new tab
              </Button>
            </DialogHeader>
            <div className="p-6 max-h-[70vh] overflow-auto">
              {previewUrl ? (
                <div className="space-y-4">
                  <div className="flex gap-2 justify-center">
                    <Button
                      variant="outline"
                      onClick={() => window.open(previewUrl, '_blank')}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Open in Browser
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = previewUrl;
                        link.download = '';
                        link.click();
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download File
                    </Button>
                  </div>
                  <iframe
                    src={previewUrl}
                    sandbox="allow-same-origin allow-scripts"
                    className="w-full h-[55vh] border-0 rounded-lg shadow-lg bg-white"
                    title="Document Preview"
                  />
                  <p className="text-xs text-center text-muted-foreground">
                    If the preview doesn't load, use "Open in Browser" button above
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
                  Preview not available for this file type
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Upload/Edit Dialog - Available to EVERYONE */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => !open && resetForm()}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editingDocument ? 'Edit Document' : 'Upload Document'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpload} className="space-y-4">
              {!editingDocument && (
                <div>
                  <label className="text-sm font-medium text-foreground">File</label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      type="file"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="bg-background text-foreground"
                    />
                  </div>
                  {selectedFile && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedFile.name} ({formatFileSize(selectedFile.size)})
                    </p>
                  )}
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-foreground">Description</label>
                <Textarea
                  placeholder="Brief description of this document..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="mt-1 bg-background text-foreground"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Project (Optional)</label>
                <Select 
                  value={form.project_id || "none"} 
                  onValueChange={(value) => setForm({ ...form, project_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="none">No project</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={uploading}>
                  {uploading ? (
                    <>
                      <Upload className="h-4 w-4 mr-2 animate-spin" />
                      {editingDocument ? 'Saving...' : 'Uploading...'}
                    </>
                  ) : (
                    editingDocument ? 'Save Changes' : 'Upload'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default DocumentsTab;
